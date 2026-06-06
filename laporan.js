// ============================================================
// laporan.js — Modul Laporan Bulanan & Log Buku
// ============================================================

// Inisialisasi filter ke bulan & tahun saat ini
function inisialisasiFilterLaporan() {
    const now = new Date();
    document.getElementById('laporanBulan').value = String(now.getMonth() + 1);
    document.getElementById('laporanTahun').value = String(now.getFullYear());
}

function tampilkanLaporanBulanan() {
    const bulan = parseInt(document.getElementById('laporanBulan').value, 10);
    const tahun = parseInt(document.getElementById('laporanTahun').value, 10);

    if (isNaN(bulan) || isNaN(tahun) || tahun < 2000 || tahun > 2099) {
        notif('Tahun tidak valid (2000–2099)', 'error'); return;
    }

    // ── Kunjungan ──────────────────────────────────────────
    const kunjFilter = kunjungan.filter(k => {
        const tgl = parseTanggalID(k.tgl);
        return tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun;
    });
    const uniquePengunjung = new Set(kunjFilter.map(k => k.nama)).size;
    document.getElementById('statKunjungan').innerHTML =
        `<strong>Total kunjungan:</strong> ${kunjFilter.length} &nbsp;|&nbsp; <strong>Pengunjung unik:</strong> ${uniquePengunjung}`;

    const tKunj = document.getElementById('tabelLaporanKunjungan');
    if (!kunjFilter.length) {
        tKunj.innerHTML = '<tr><td colspan="3" class="teks-tengah">Tidak ada data kunjungan</td></tr>';
    } else {
        const frag = document.createDocumentFragment();
        kunjFilter.forEach(k => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${escapeHtml(k.tgl)}</td><td>${escapeHtml(k.nama)}</td><td>${escapeHtml(k.status)}</td>`;
            frag.appendChild(tr);
        });
        tKunj.innerHTML = '';
        tKunj.appendChild(frag);
    }

    // ── Sirkulasi ──────────────────────────────────────────
    const sirFilter = sirkulasi.filter(s => {
        if (!s.tglPinjam) return false;
        const tgl = parseTanggalID(s.tglPinjam);
        return tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun;
    });
    const totalDenda = sirFilter.reduce((acc, s) => acc + (s.denda || 0), 0);
    const jmlKembali  = sirFilter.filter(s => s.status === 'Dikembalikan').length;
    const masihPinjam = sirFilter.length - jmlKembali;

    document.getElementById('statSirkulasi').innerHTML =
        `<strong>Total peminjaman:</strong> ${sirFilter.length} &nbsp;|&nbsp; ` +
        `<strong>Kembali:</strong> ${jmlKembali} &nbsp;|&nbsp; ` +
        `<strong>Masih dipinjam:</strong> ${masihPinjam} &nbsp;|&nbsp; ` +
        `<strong>Total Denda:</strong> Rp ${totalDenda.toLocaleString('id-ID')}`;

    const tSir = document.getElementById('tabelLaporanSirkulasi');
    if (!sirFilter.length) {
        tSir.innerHTML = '<tr><td colspan="5" class="teks-tengah">Tidak ada transaksi</td></tr>';
    } else {
        const frag = document.createDocumentFragment();
        sirFilter.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml(s.tglPinjam)}</td>
                <td>${escapeHtml(s.peminjam)}</td>
                <td>${escapeHtml(s.judul)}</td>
                <td>${escapeHtml(s.status)}</td>
                <td>${s.denda ? 'Rp ' + s.denda.toLocaleString('id-ID') : '-'}</td>`;
            frag.appendChild(tr);
        });
        tSir.innerHTML = '';
        tSir.appendChild(frag);
    }
}

function eksporLaporanBulanan() {
    const bulan    = parseInt(document.getElementById('laporanBulan').value, 10);
    const tahun    = parseInt(document.getElementById('laporanTahun').value, 10);
    const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni',
                       'Juli','Agustus','September','Oktober','November','Desember'][bulan - 1];

    const kunjFilter = kunjungan.filter(k => {
        const tgl = parseTanggalID(k.tgl);
        return tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun;
    });
    const sirFilter = sirkulasi.filter(s => {
        if (!s.tglPinjam) return false;
        const tgl = parseTanggalID(s.tglPinjam);
        return tgl && tgl.getMonth() + 1 === bulan && tgl.getFullYear() === tahun;
    });
    const totalDenda = sirFilter.reduce((acc, s) => acc + (s.denda || 0), 0);

    let csv = `LAPORAN BULAN ${namaBulan} ${tahun}\n\n`;
    csv += 'KUNJUNGAN:\nTanggal,Nama,Status\n';
    kunjFilter.forEach(k => {
        csv += [csvVal(k.tgl), csvVal(k.nama), csvVal(k.status)].join(',') + '\n';
    });
    csv += `\nTotal Kunjungan,${kunjFilter.length}\n`;
    csv += `Pengunjung Unik,${new Set(kunjFilter.map(k => k.nama)).size}\n`;

    csv += '\nSIRKULASI:\nTanggal Pinjam,Peminjam,Buku,Status,Denda\n';
    sirFilter.forEach(s => {
        csv += [csvVal(s.tglPinjam), csvVal(s.peminjam), csvVal(s.judul), csvVal(s.status), csvVal(s.denda || 0)].join(',') + '\n';
    });
    csv += `\nTotal Denda,${csvVal('Rp ' + totalDenda.toLocaleString('id-ID'))}\n`;

    downloadCSV(csv, `Laporan_${namaBulan}_${tahun}.csv`);
}

// ── Log Buku ───────────────────────────────────────────────
function tampilkanLogBuku() {
    const tbody = document.getElementById('tabelLogBuku');
    if (!tbody) return;
    if (!logBuku.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="teks-tengah">Belum ada aktivitas</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    logBuku.forEach(log => {
        const aksiLabel = log.aksi === 'TAMBAH'
            ? '<span style="color:var(--success)">➕ TAMBAH</span>'
            : '<span style="color:var(--danger)">🗑️ HAPUS</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(log.waktu)}</td>
            <td>${aksiLabel}</td>
            <td>${escapeHtml(log.judul)}</td>
            <td>${escapeHtml(log.isbn)}</td>
            <td>${escapeHtml(log.pengarang)}</td>
            <td>${escapeHtml(String(log.stok))}</td>`;
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function eksporLogBuku() {
    if (!logBuku.length) { notif('Tidak ada log untuk diekspor', 'error'); return; }
    let csv = 'Waktu,Aksi,Judul,ISBN,Pengarang,Stok\n';
    logBuku.forEach(log => {
        csv += [
            csvVal(log.waktu), csvVal(log.aksi), csvVal(log.judul),
            csvVal(log.isbn), csvVal(log.pengarang), csvVal(log.stok)
        ].join(',') + '\n';
    });
    downloadCSV(csv, 'Log_Aktivitas_Buku.csv');
}

// Inisialisasi filter laporan ke bulan/tahun saat ini saat halaman dimuat
inisialisasiFilterLaporan();
tampilkanLogBuku();
