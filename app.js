// ============================================================
// app.js — Core: konstanta, data global, utilitas
// ============================================================

const TARIF_DENDA   = 1000; // Rp per hari
const MAX_PINJAM    = 3;    // Maksimum buku dipinjam per anggota
const MAX_FOTO_KB   = 200;  // Batas ukuran foto sampul
const LOG_MAX_ITEMS = 200;  // Batas entri log buku

// ── Pemuatan data dengan fallback ──────────────────────────
function muatData(key, defaultVal = []) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaultVal;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : defaultVal;
    } catch {
        console.warn(`Data rusak untuk key "${key}", direset.`);
        return defaultVal;
    }
}

// ── Penyimpanan dengan penanganan localStorage penuh ───────
function simpanData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            tampilNotifError('Penyimpanan penuh! Hapus beberapa data lama atau ekspor terlebih dahulu.');
        } else {
            tampilNotifError('Gagal menyimpan data: ' + e.message);
        }
        return false;
    }
}

// ── Data global ────────────────────────────────────────────
let kunjungan = muatData('lib_tamu');
let anggota   = muatData('lib_anggota');
let buku      = muatData('lib_buku');
let sirkulasi = muatData('lib_sirkulasi');
let logBuku   = muatData('lib_log_buku');

// ── Migrasi buku: tambah properti baru jika belum ada ──────
let migrasi = false;
buku = buku.map(b => {
    const baru = { ...b };
    if (baru.penerbit === undefined) { baru.penerbit = '';   migrasi = true; }
    if (baru.tahun    === undefined) { baru.tahun    = null; migrasi = true; }
    if (baru.ddc      === undefined) { baru.ddc      = '';   migrasi = true; }
    if (baru.kondisi  === undefined) { baru.kondisi  = 'Baik'; migrasi = true; }
    if (baru.foto     === undefined) { baru.foto     = '';   migrasi = true; }
    // Pastikan setiap buku punya id unik untuk referensi stabil
    if (!baru.id) { baru.id = 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); migrasi = true; }
    return baru;
});
if (migrasi) simpanData('lib_buku', buku);

// ── Migrasi anggota ────────────────────────────────────────
anggota = anggota.map(a => {
    const baru = { ...a };
    if (baru.kontak === undefined) baru.kontak = '';
    if (!baru.id) baru.id = 'ang_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    return baru;
});

// ── Migrasi sirkulasi: ganti bukuIdx dengan bukuId ─────────
sirkulasi = sirkulasi.map(s => {
    const baru = { ...s };
    // Jika masih pakai indeks numerik, coba konversi ke id stabil
    if (baru.bukuIdx !== undefined && !baru.bukuId) {
        const b = buku[baru.bukuIdx];
        baru.bukuId = b ? b.id : null;
        delete baru.bukuIdx;
    }
    return baru;
});

// ── Navigasi Tab ───────────────────────────────────────────
function switchTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
    });
    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
    evt.currentTarget.setAttribute('aria-selected', 'true');

    if (tabId === 'tab-sirkulasi') dapatkanDropdownSirkulasi();
    if (tabId === 'tab-laporan')   { inisialisasiFilterLaporan(); tampilkanLaporanBulanan(); tampilkanLogBuku(); }
}

// ── Toast Notifikasi ───────────────────────────────────────
let toastTimer = null;
function notif(txt, tipe = 'sukses') {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');
    toastText.textContent = txt;
    toast.className = 'toast show' + (tipe === 'error' ? ' toast-error' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
function tampilNotifError(txt) { notif(txt, 'error'); }

// ── Modal Konfirmasi (menggantikan confirm() bawaan) ───────
let _modalCallback = null;
function konfirmasi(pesan, callback, labelBtn = 'Ya, Hapus') {
    document.getElementById('modalPesan').textContent = pesan;
    document.getElementById('modalKonfirmBtn').textContent = labelBtn;
    document.getElementById('modalOverlay').style.display = 'flex';
    _modalCallback = callback;
    document.getElementById('modalKonfirmBtn').onclick = () => {
        tutupModal();
        if (typeof _modalCallback === 'function') _modalCallback();
    };
}
function tutupModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    _modalCallback = null;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupModal(); });

// ── Ekspor CSV ─────────────────────────────────────────────
function downloadCSV(konten, namaFile) {
    const BOM = '\uFEFF'; // BOM agar Excel baca UTF-8 dengan benar
    const blob = new Blob([BOM + konten], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = namaFile;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// ── Sanitasi HTML (XSS) ────────────────────────────────────
// Mencegah injeksi HTML/JS dari data yang dirender ke DOM
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}

// ── Sanitasi nilai untuk CSV ───────────────────────────────
// Mencegah CSV injection (=, +, -, @ di awal nilai)
function csvVal(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).replace(/"/g, '""'); // escape kutip ganda
    // Awali dengan tab jika ada karakter berbahaya di awal
    if (/^[=+\-@\t]/.test(s)) s = '\t' + s;
    return `"${s}"`;
}

// ── Parser tanggal lokal format dd/mm/yyyy ─────────────────
function parseTanggalID(tglStr) {
    if (!tglStr) return null;
    const parts = tglStr.split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const tgl = new Date(y, m, d);
    // Validasi hasil parsing
    if (isNaN(tgl.getTime()) || tgl.getDate() !== d || tgl.getMonth() !== m) return null;
    return tgl;
}

// ── Pencarian buku by id stabil ────────────────────────────
function cariBukuById(bukuId) {
    return buku.find(b => b.id === bukuId) || null;
}

// ── Hitung buku sedang dipinjam oleh anggota ──────────────
function hitungPinjamanAktif(namaAnggota) {
    return sirkulasi.filter(s => s.peminjam === namaAnggota && s.status === 'Dipinjam').length;
}

// ── Log aktivitas buku ─────────────────────────────────────
function catatLogBuku(aksi, dataBuku) {
    const now = new Date();
    logBuku.unshift({
        waktu    : now.toLocaleString('id-ID'),
        aksi,
        judul    : dataBuku.judul,
        isbn     : dataBuku.isbn,
        pengarang: dataBuku.pengarang,
        stok     : dataBuku.stok
    });
    if (logBuku.length > LOG_MAX_ITEMS) logBuku.length = LOG_MAX_ITEMS;
    simpanData('lib_log_buku', logBuku);
}
