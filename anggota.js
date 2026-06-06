// ============================================================
// anggota.js — Modul Data Anggota
// ============================================================

function renderAnggota(data) {
    const tbody = document.getElementById('tabelAnggota');
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="teks-tengah">Belum ada anggota</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    data.forEach(a => {
        // Cari indeks di array asli (bukan data yang difilter)
        const idxAsli = anggota.findIndex(x => x.id === a.id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(a.nis)}</td>
            <td><strong>${escapeHtml(a.nama)}</strong></td>
            <td>${escapeHtml(a.kelas)}</td>
            <td>${escapeHtml(a.kontak || '-')}</td>
            <td><button class="btn btn-danger" onclick="hapusAnggota(${idxAsli})">Hapus</button></td>`;
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function tampilkanAnggota() { renderAnggota(anggota); }

function filterAnggota() {
    const keyword = document.getElementById('searchAnggota').value.toLowerCase().trim();
    if (!keyword) return renderAnggota(anggota);
    const filtered = anggota.filter(a =>
        a.nis.toLowerCase().includes(keyword)  ||
        a.nama.toLowerCase().includes(keyword) ||
        a.kelas.toLowerCase().includes(keyword)
    );
    renderAnggota(filtered);
}

function tambahAnggota(e) {
    e.preventDefault();
    const nis    = document.getElementById('anggotaNis').value.trim();
    const nama   = document.getElementById('anggotaNama').value.trim();
    const kelas  = document.getElementById('anggotaKelas').value.trim();
    const kontak = document.getElementById('anggotaKontak').value.trim();

    // Validasi
    if (!nis)   { notif('NIS tidak boleh kosong', 'error'); return; }
    if (!nama)  { notif('Nama tidak boleh kosong', 'error'); return; }
    if (!kelas) { notif('Kelas/Jabatan tidak boleh kosong', 'error'); return; }
    if (anggota.some(a => a.nis === nis)) {
        notif('NIS sudah terdaftar', 'error'); return;
    }
    if (kontak && !/^[0-9+\-\s]{8,20}$/.test(kontak)) {
        notif('Format nomor HP tidak valid', 'error'); return;
    }

    const baru = {
        id    : 'ang_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        nis, nama, kelas, kontak
    };
    anggota.push(baru);
    if (!simpanData('lib_anggota', anggota)) {
        anggota.pop(); return;
    }
    document.getElementById('formAnggota').reset();
    tampilkanAnggota();
    notif(`Anggota "${nama}" berhasil didaftarkan`);
}

function hapusAnggota(i) {
    if (i < 0 || i >= anggota.length) return;
    const a = anggota[i];
    // Cegah hapus jika masih punya buku dipinjam
    const pinjamAktif = sirkulasi.filter(s => s.peminjam === a.nama && s.status === 'Dipinjam');
    if (pinjamAktif.length > 0) {
        notif(`Anggota masih memiliki ${pinjamAktif.length} buku yang belum dikembalikan`, 'error');
        return;
    }
    konfirmasi(
        `Hapus anggota "${a.nama}" (NIS: ${a.nis})?`,
        () => {
            anggota.splice(i, 1);
            simpanData('lib_anggota', anggota);
            tampilkanAnggota();
            notif('Anggota dihapus');
        }
    );
}

function eksporAnggota() {
    if (!anggota.length) { notif('Tidak ada data untuk diekspor', 'error'); return; }
    let csv = 'NIS,Nama,Kelas,No HP\n';
    anggota.forEach(a => {
        csv += [csvVal(a.nis), csvVal(a.nama), csvVal(a.kelas), csvVal(a.kontak || '-')].join(',') + '\n';
    });
    downloadCSV(csv, 'Data_Anggota.csv');
}

tampilkanAnggota();
