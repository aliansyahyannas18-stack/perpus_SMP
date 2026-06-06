// ============================================================
// tamu.js — Modul Buku Tamu
// ============================================================

function tampilkanTamu() {
    const tbody = document.getElementById('tabelTamu');
    if (!kunjungan.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="teks-tengah">Belum ada pengunjung</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    kunjungan.forEach((t, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(t.tgl)}</td>
            <td>${escapeHtml(t.jam)}</td>
            <td><strong>${escapeHtml(t.nama)}</strong></td>
            <td>${escapeHtml(t.status)}</td>
            <td><button class="btn btn-danger" data-i="${i}" onclick="hapusTamu(${i})">Hapus</button></td>`;
        fragment.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function tambahTamu(e) {
    e.preventDefault();
    const nama   = document.getElementById('tamuNama').value.trim();
    const status = document.getElementById('tamuStatus').value;

    if (!nama)   { notif('Nama tidak boleh kosong', 'error'); return; }
    if (!status) { notif('Pilih status terlebih dahulu', 'error'); return; }

    const d = new Date();
    kunjungan.push({
        tgl   : d.toLocaleDateString('id-ID'),
        jam   : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        nama,
        status
    });
    if (!simpanData('lib_tamu', kunjungan)) {
        kunjungan.pop(); // rollback
        return;
    }
    document.getElementById('formTamu').reset();
    tampilkanTamu();
    notif('Pengunjung dicatat');
}

function hapusTamu(i) {
    if (i < 0 || i >= kunjungan.length) return;
    konfirmasi(
        `Hapus catatan kunjungan "${kunjungan[i].nama}"?`,
        () => {
            kunjungan.splice(i, 1);
            simpanData('lib_tamu', kunjungan);
            tampilkanTamu();
            notif('Data kunjungan dihapus');
        }
    );
}

function eksporTamu() {
    if (!kunjungan.length) { notif('Tidak ada data untuk diekspor', 'error'); return; }
    let csv = 'Tanggal,Jam,Nama,Status\n';
    kunjungan.forEach(t => {
        csv += [csvVal(t.tgl), csvVal(t.jam), csvVal(t.nama), csvVal(t.status)].join(',') + '\n';
    });
    downloadCSV(csv, `Buku_Tamu_${new Date().toLocaleDateString('id-ID').replace(/\//g,'-')}.csv`);
}

tampilkanTamu();
