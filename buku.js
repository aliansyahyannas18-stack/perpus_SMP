// ============================================================
// buku.js — Modul Master Buku & Sirkulasi
// ============================================================

// ── Foto Sampul ────────────────────────────────────────────
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
    });
}

// ── Kompresi gambar sederhana via Canvas ───────────────────
function kompresGambar(file, maxKB = MAX_FOTO_KB) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            // Skala jika terlalu besar
            const MAX_DIM = 400;
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
                else                { width  = Math.round(width  * MAX_DIM / height); height = MAX_DIM; }
            }
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            let quality = 0.85;
            let result  = canvas.toDataURL('image/jpeg', quality);
            // Turunkan kualitas sampai di bawah batas
            while (result.length > maxKB * 1024 * 1.37 && quality > 0.3) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }
            if (result.length > maxKB * 1024 * 1.37) {
                reject(new Error(`Foto terlalu besar bahkan setelah kompresi (maks ${maxKB}KB)`));
            } else {
                resolve(result);
            }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('File gambar tidak valid')); };
        img.src = url;
    });
}

// ── Tambah Buku ────────────────────────────────────────────
async function tambahBuku(e) {
    e.preventDefault();
    const judul     = document.getElementById('bukuJudul').value.trim();
    const pengarang = document.getElementById('bukuPengarang').value.trim();
    const penerbit  = document.getElementById('bukuPenerbit').value.trim();
    const isbn      = document.getElementById('bukuIsbn').value.trim();
    const tahunRaw  = document.getElementById('bukuTahun').value;
    const tahun     = tahunRaw ? parseInt(tahunRaw, 10) : null;
    const kategori  = document.getElementById('bukuKategori').value;
    const ddc       = document.getElementById('bukuDdc').value.trim();
    const stok      = parseInt(document.getElementById('bukuStok').value, 10);
    const lokasi    = document.getElementById('bukuLokasi').value.trim();
    const kondisi   = document.getElementById('bukuKondisi').value;
    const file      = document.getElementById('bukuFoto').files[0];

    // Validasi
    if (!judul)    { notif('Judul buku wajib diisi', 'error'); return; }
    if (!pengarang){ notif('Pengarang wajib diisi', 'error'); return; }
    if (!isbn)     { notif('ISBN wajib diisi', 'error'); return; }
    if (!kategori) { notif('Kategori wajib dipilih', 'error'); return; }
    if (!lokasi)   { notif('Lokasi rak wajib diisi', 'error'); return; }
    if (isNaN(stok) || stok < 1) { notif('Stok minimal 1', 'error'); return; }
    if (tahun && (tahun < 1800 || tahun > new Date().getFullYear() + 1)) {
        notif('Tahun terbit tidak valid', 'error'); return;
    }
    if (buku.some(b => b.isbn === isbn)) {
        notif(`ISBN "${isbn}" sudah terdaftar`, 'error'); return;
    }

    let fotoBase64 = '';
    if (file) {
        try {
            fotoBase64 = await kompresGambar(file, MAX_FOTO_KB);
        } catch (err) {
            notif(err.message, 'error'); return;
        }
    }

    const bukuBaru = {
        id: 'bk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        judul, pengarang, penerbit, isbn, tahun, kategori, ddc, stok, lokasi, kondisi, foto: fotoBase64
    };
    buku.push(bukuBaru);
    if (!simpanData('lib_buku', buku)) {
        buku.pop(); return;
    }
    document.getElementById('formBuku').reset();
    tampilkanBuku();
    catatLogBuku('TAMBAH', bukuBaru);
    notif(`Buku "${judul}" berhasil disimpan`);
}

// ── Render Tabel Buku ──────────────────────────────────────
function renderBuku(dataBuku) {
    const tbody = document.getElementById('tabelBuku');
    if (!dataBuku.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="teks-tengah">Tidak ada buku ditemukan</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    dataBuku.forEach(b => {
        const idxAsli = buku.findIndex(x => x.id === b.id);
        const fotoHtml = b.foto
            ? `<img src="${b.foto}" alt="Sampul ${escapeHtml(b.judul)}" style="width:40px;height:auto;border-radius:4px;">`
            : '<i class="ti ti-photo" style="font-size:24px;color:#aaa;" aria-label="Tidak ada foto"></i>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${fotoHtml}</td>
            <td><strong>${escapeHtml(b.judul)}</strong></td>
            <td>${escapeHtml(b.pengarang)}</td>
            <td>${escapeHtml(b.penerbit || '-')}</td>
            <td>${b.tahun || '-'}</td>
            <td>${escapeHtml(b.isbn)}</td>
            <td>${escapeHtml(b.kategori)}</td>
            <td>${escapeHtml(b.lokasi)}</td>
            <td><strong>${b.stok}</strong></td>
            <td><span class="badge ${b.kondisi === 'Rusak' ? 'badge-danger' : b.kondisi === 'Cukup' ? 'badge-warning' : 'badge-success'}">${escapeHtml(b.kondisi || 'Baik')}</span></td>
            <td><button class="btn btn-danger" onclick="hapusBuku(${idxAsli})">Hapus</button></td>`;
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function tampilkanBuku() { renderBuku(buku); }

function filterBuku() {
    const keyword = document.getElementById('searchBuku').value.toLowerCase().trim();
    if (!keyword) return renderBuku(buku);
    const filtered = buku.filter(b =>
        b.judul.toLowerCase().includes(keyword)    ||
        b.pengarang.toLowerCase().includes(keyword)||
        (b.penerbit && b.penerbit.toLowerCase().includes(keyword)) ||
        b.isbn.toLowerCase().includes(keyword)     ||
        b.kategori.toLowerCase().includes(keyword) ||
        (b.ddc && b.ddc.toLowerCase().includes(keyword))
    );
    renderBuku(filtered);
}

function clearSearch() {
    document.getElementById('searchBuku').value = '';
    renderBuku(buku);
}

function hapusBuku(i) {
    if (i < 0 || i >= buku.length) return;
    const b = buku[i];
    const dipinjam = sirkulasi.some(s => s.bukuId === b.id && s.status === 'Dipinjam');
    if (dipinjam) {
        notif('Buku sedang dipinjam, tidak dapat dihapus', 'error');
        return;
    }
    konfirmasi(
        `Hapus buku "${b.judul}" (ISBN: ${b.isbn})?`,
        () => {
            const bukuTerhapus = { ...b };
            buku.splice(i, 1);
            simpanData('lib_buku', buku);
            tampilkanBuku();
            catatLogBuku('HAPUS', bukuTerhapus);
            notif(`Buku "${bukuTerhapus.judul}" dihapus`);
        }
    );
}

function eksporBuku() {
    if (!buku.length) { notif('Tidak ada data untuk diekspor', 'error'); return; }
    let csv = 'Judul,Pengarang,Penerbit,Tahun,ISBN,Kategori,DDC,Stok,Lokasi,Kondisi\n';
    buku.forEach(b => {
        csv += [
            csvVal(b.judul), csvVal(b.pengarang), csvVal(b.penerbit),
            csvVal(b.tahun), csvVal(b.isbn), csvVal(b.kategori),
            csvVal(b.ddc), csvVal(b.stok), csvVal(b.lokasi), csvVal(b.kondisi || 'Baik')
        ].join(',') + '\n';
    });
    downloadCSV(csv, 'Katalog_Buku.csv');
}

// ── SIRKULASI ──────────────────────────────────────────────

function dapatkanDropdownSirkulasi() {
    const selAnggota = document.getElementById('sirAnggota');
    const selBuku    = document.getElementById('sirBuku');

    selAnggota.innerHTML = '<option value="" disabled selected>-- Pilih Anggota --</option>';
    selBuku.innerHTML    = '<option value="" disabled selected>-- Pilih Buku --</option>';

    anggota.forEach(a => {
        const pinjamAktif = hitungPinjamanAktif(a.nama);
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `${a.nama} (${a.kelas})${pinjamAktif > 0 ? ` — ${pinjamAktif} dipinjam` : ''}`;
        if (pinjamAktif >= MAX_PINJAM) opt.disabled = true;
        selAnggota.appendChild(opt);
    });

    buku.forEach(b => {
        if (b.stok > 0) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.judul} (Stok: ${b.stok})`;
            selBuku.appendChild(opt);
        }
    });

    // Set batas kembali minimal hari ini
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sirBatas').min = today;
}

function cekStatusPeminjam() {
    const anggotaId = document.getElementById('sirAnggota').value;
    const infoBox   = document.getElementById('infoMaxPinjam');
    if (!anggotaId) { infoBox.style.display = 'none'; return; }
    const a = anggota.find(x => x.id === anggotaId);
    if (!a) { infoBox.style.display = 'none'; return; }
    const aktif = hitungPinjamanAktif(a.nama);
    if (aktif > 0) {
        infoBox.style.display = 'block';
        infoBox.textContent   = `${a.nama} sedang meminjam ${aktif} dari ${MAX_PINJAM} buku yang diizinkan.`;
        infoBox.className     = aktif >= MAX_PINJAM ? 'info-box info-box-danger' : 'info-box';
    } else {
        infoBox.style.display = 'none';
    }
}

function renderSirkulasi(data) {
    const tbody = document.getElementById('tabelSirkulasi');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="teks-tengah">Tidak ada transaksi</td></tr>';
        return;
    }
    // Indeks di array asli (bukan data terfilter)
    const fragment = document.createDocumentFragment();
    data.forEach(s => {
        const idxAsli = sirkulasi.findIndex(x => x === s);
        const statusBadge = s.status === 'Dipinjam'
            ? '<span class="badge badge-danger">Dipinjam</span>'
            : '<span class="badge badge-success">Kembali</span>';
        const tombol = s.status === 'Dipinjam'
            ? `<button class="btn btn-success" onclick="kembalikanBuku(${idxAsli})">Kembalikan</button>`
            : '<span class="teks-muted">Selesai</span>';
        // Tandai jika terlambat
        const today   = new Date(); today.setHours(0,0,0,0);
        const batasD  = new Date(s.batas); batasD.setHours(0,0,0,0);
        const terlambat = s.status === 'Dipinjam' && today > batasD;
        const tr = document.createElement('tr');
        if (terlambat) tr.classList.add('baris-terlambat');
        tr.innerHTML = `
            <td>${escapeHtml(s.peminjam)}</td>
            <td>${escapeHtml(s.judul)}</td>
            <td>${escapeHtml(s.tglPinjam || '-')}</td>
            <td>${escapeHtml(s.batas)}</td>
            <td>${statusBadge}</td>
            <td>${s.denda ? 'Rp ' + s.denda.toLocaleString('id-ID') : '-'}</td>
            <td>${tombol}</td>`;
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function tampilkanSirkulasi() { filterSirkulasi(); }

function filterSirkulasi() {
    const filter = document.getElementById('filterStatusSirkulasi').value;
    const data   = filter ? sirkulasi.filter(s => s.status === filter) : sirkulasi;
    renderSirkulasi(data);
}

function tambahTransaksi(e) {
    e.preventDefault();
    const anggotaId = document.getElementById('sirAnggota').value;
    const bukuId    = document.getElementById('sirBuku').value;
    const batas     = document.getElementById('sirBatas').value;

    if (!anggotaId) { notif('Pilih peminjam terlebih dahulu', 'error'); return; }
    if (!bukuId)    { notif('Pilih buku terlebih dahulu', 'error'); return; }
    if (!batas)     { notif('Tentukan batas kembali', 'error'); return; }

    const today = new Date().toISOString().split('T')[0];
    if (batas < today) { notif('Batas kembali tidak boleh di masa lalu', 'error'); return; }

    const a = anggota.find(x => x.id === anggotaId);
    const b = buku.find(x => x.id === bukuId);

    if (!a) { notif('Data anggota tidak ditemukan', 'error'); return; }
    if (!b) { notif('Data buku tidak ditemukan', 'error'); return; }
    if (b.stok <= 0) { notif('Stok buku habis', 'error'); return; }

    const pinjamAktif = hitungPinjamanAktif(a.nama);
    if (pinjamAktif >= MAX_PINJAM) {
        notif(`${a.nama} sudah meminjam ${MAX_PINJAM} buku (batas maksimum)`, 'error');
        return;
    }

    // Cek apakah buku yang sama sudah dipinjam oleh anggota ini
    const sudahPinjamBukuIni = sirkulasi.some(
        s => s.bukuId === bukuId && s.peminjam === a.nama && s.status === 'Dipinjam'
    );
    if (sudahPinjamBukuIni) {
        notif(`${a.nama} sudah meminjam buku ini`, 'error');
        return;
    }

    b.stok -= 1;
    simpanData('lib_buku', buku);

    const tglPinjamObj = new Date();
    sirkulasi.push({
        peminjam : a.nama,
        judul    : b.judul,
        bukuId   : b.id,
        batas,
        tglPinjam: tglPinjamObj.toLocaleDateString('id-ID'),
        status   : 'Dipinjam',
        denda    : 0,
        tglKembali: null
    });
    simpanData('lib_sirkulasi', sirkulasi);
    document.getElementById('formSirkulasi').reset();
    document.getElementById('infoMaxPinjam').style.display = 'none';
    dapatkanDropdownSirkulasi();
    tampilkanSirkulasi();
    tampilkanBuku();
    notif(`"${b.judul}" berhasil dipinjam oleh ${a.nama}`);
}

function kembalikanBuku(i) {
    if (i < 0 || i >= sirkulasi.length) return;
    const tr = sirkulasi[i];
    if (tr.status !== 'Dipinjam') { notif('Buku sudah dikembalikan', 'error'); return; }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const batasD = new Date(tr.batas); batasD.setHours(0, 0, 0, 0);
    let denda = 0;
    let infoTerlambat = '';
    if (today > batasD) {
        const selisih = Math.floor((today - batasD) / 86400000);
        denda = selisih * TARIF_DENDA;
        infoTerlambat = `\nTerlambat ${selisih} hari — denda: Rp ${denda.toLocaleString('id-ID')}`;
    }

    konfirmasi(
        `Kembalikan buku "${tr.judul}" atas nama ${tr.peminjam}?${infoTerlambat}`,
        () => {
            const b = cariBukuById(tr.bukuId);
            if (b) { b.stok += 1; simpanData('lib_buku', buku); }
            tr.status    = 'Dikembalikan';
            tr.denda     = denda;
            tr.tglKembali = today.toISOString().slice(0, 10);
            simpanData('lib_sirkulasi', sirkulasi);
            tampilkanSirkulasi();
            tampilkanBuku();
            if (denda > 0) notif(`Denda: Rp ${denda.toLocaleString('id-ID')}`);
            else notif('Buku berhasil dikembalikan');
        },
        'Ya, Kembalikan'
    );
}

function eksporTransaksi() {
    if (!sirkulasi.length) { notif('Tidak ada data untuk diekspor', 'error'); return; }
    let csv = 'Peminjam,Buku,Tgl Pinjam,Batas,Status,Denda,Tgl Kembali\n';
    sirkulasi.forEach(s => {
        csv += [
            csvVal(s.peminjam), csvVal(s.judul), csvVal(s.tglPinjam),
            csvVal(s.batas), csvVal(s.status), csvVal(s.denda || 0), csvVal(s.tglKembali || '-')
        ].join(',') + '\n';
    });
    downloadCSV(csv, 'Laporan_Sirkulasi.csv');
}

tampilkanBuku();
tampilkanSirkulasi();
