/* ==========================================================================
   DewpBank - Financial Report Generation & Print Management (PDF Ready)
   ========================================================================== */

import { appState } from '../state.js';
import { formatRupiah, formatDate, escapeHtml, getCategoryObj, showToast } from '../utils.js';

export function compileFinancialReportHtml(preset = 'CURRENT_MONTH') {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  let txToPrint = [];
  let periodLabel = '';
  let fallbackNote = '';

  const allTx = Array.isArray(appState.transactions) ? appState.transactions : [];

  if (preset === 'FILTERED') {
    const searchQuery = (document.getElementById('searchTxInput')?.value || '').toLowerCase().trim();
    const filterType = document.getElementById('filterTypeSelect')?.value || 'ALL';
    const filterCategory = document.getElementById('filterCategorySelect')?.value || 'ALL';
    const filterPayment = document.getElementById('filterPaymentSelect')?.value || 'ALL';
    const datePreset = appState.txDatePreset || 'ALL';
    const dateStart = document.getElementById('txFilterDateStart')?.value;
    const dateEnd = document.getElementById('txFilterDateEnd')?.value;

    txToPrint = allTx.filter(tx => {
      if (!tx) return false;
      const cat = getCategoryObj(tx.category) || { name: tx.category || 'Umum' };
      const paymentStr = tx.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (tx.payment || 'Tunai / Cash');

      const matchesSearch = !searchQuery ||
                            (tx.note || '').toLowerCase().includes(searchQuery) ||
                            (cat.name || '').toLowerCase().includes(searchQuery) ||
                            paymentStr.toLowerCase().includes(searchQuery) ||
                            String(tx.amount || 0).includes(searchQuery);

      const matchesType = filterType === 'ALL' || tx.type === filterType;
      const matchesCat = filterCategory === 'ALL' || tx.category === filterCategory;

      let matchesPayment = true;
      if (filterPayment !== 'ALL') {
        if (filterPayment === 'Uang di Orang Tua') {
          matchesPayment = tx.payment === 'Uang di Orang Tua' || tx.payment === 'Uang di Mama';
        } else {
          matchesPayment = tx.payment === filterPayment;
        }
      }

      let matchesDate = true;
      if (tx.date) {
        const txDate = new Date(tx.date);
        if (!isNaN(txDate.getTime())) {
          if (datePreset === 'THIS_MONTH') {
            matchesDate = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
          } else if (datePreset === 'LAST_30') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
            matchesDate = txDate >= thirtyDaysAgo;
          } else if (datePreset === 'CUSTOM') {
            if (dateStart) matchesDate = matchesDate && txDate >= new Date(dateStart + 'T00:00:00');
            if (dateEnd) matchesDate = matchesDate && txDate <= new Date(dateEnd + 'T23:59:59');
          }
        }
      }

      return matchesSearch && matchesType && matchesCat && matchesPayment && matchesDate;
    });

    periodLabel = `Filter Sesuai Tampilan (${txToPrint.length} Transaksi)`;
  } else if (preset === 'ALL') {
    txToPrint = [...allTx];
    periodLabel = `Semua Waktu (${txToPrint.length} Transaksi)`;
  } else {
    // CURRENT_MONTH
    const currentMonthTx = allTx.filter(t => {
      if (!t || !t.date) return false;
      const d = new Date(t.date);
      return !isNaN(d.getTime()) && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if (currentMonthTx.length > 0) {
      txToPrint = currentMonthTx;
      periodLabel = `${monthNames[currentMonth]} ${currentYear}`;
      if (allTx.length > currentMonthTx.length) {
        fallbackNote = `Menampilkan ${currentMonthTx.length} transaksi pada bulan ${monthNames[currentMonth]} ${currentYear}. Total transaksi di akun Anda ada ${allTx.length}. Anda dapat memilih opsi "Semua Waktu" pada dropdown di atas untuk mencetak seluruh transaksi.`;
      }
    } else if (allTx.length > 0) {
      txToPrint = [...allTx];
      periodLabel = `Semua Riwayat Transaksi (${txToPrint.length} Transaksi)`;
      fallbackNote = `Belum ada transaksi di bulan ${monthNames[currentMonth]} ${currentYear}, sehingga sistem otomatis menampilkan seluruh ${allTx.length} riwayat transaksi Anda.`;
      const periodSelect = document.getElementById('selectPrintReportPeriod');
      if (periodSelect) periodSelect.value = 'ALL';
    } else {
      txToPrint = [];
      periodLabel = `${monthNames[currentMonth]} ${currentYear}`;
    }
  }

  txToPrint.sort((a, b) => new Date(a.date) - new Date(b.date));

  let totalIncome = 0;
  let totalExpense = 0;
  const categorySummary = {};

  txToPrint.forEach(t => {
    if (!t) return;
    const amt = Number(t.amount) || 0;
    if (t.type === 'INCOME') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      const cId = t.category || 'cat_other_exp';
      categorySummary[cId] = (categorySummary[cId] || 0) + amt;
    }
  });

  const netSavings = totalIncome - totalExpense;
  const userEmail = (appState.user && appState.user.email) ? appState.user.email : 'Pengguna Artha';
  const momBal = Number(appState.momBalance) || 0;
  const budgetsObj = (appState.budgets && typeof appState.budgets === 'object') ? appState.budgets : {};

  let catRowsHtml = '';
  Object.keys(categorySummary).forEach(catId => {
    const catObj = getCategoryObj(catId) || { name: catId || 'Lainnya' };
    const spent = categorySummary[catId] || 0;
    const limit = Number(budgetsObj[catId]) || 0;
    const pct = limit > 0 ? Math.round((spent / limit) * 100) + '%' : '-';
    catRowsHtml += `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 500;">${escapeHtml(catObj.name)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #e11d48;">${formatRupiah(spent)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">${limit > 0 ? formatRupiah(limit) : 'Tidak dibatasi'}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${pct}</td>
      </tr>
    `;
  });

  let txRowsHtml = '';
  txToPrint.forEach((t, i) => {
    if (!t) return;
    const catObj = getCategoryObj(t.category) || { name: t.category || 'Lainnya' };
    const catName = catObj?.name || t.category || 'Umum';
    txRowsHtml += `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 8.5pt;">${i + 1}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; font-size: 8.5pt;">${formatDate(t.date)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; font-weight: 600; color: ${t.type === 'INCOME' ? '#059669' : '#e11d48'};">
          ${t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt;">${escapeHtml(catName)}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; color: #475569;">
          ${escapeHtml(t.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (t.payment || 'Tunai / Cash'))}
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt;">${escapeHtml(t.note || '-')}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; font-size: 8.5pt; white-space: nowrap; color: ${t.type === 'INCOME' ? '#059669' : '#e11d48'};">
          ${t.type === 'INCOME' ? '+' : '-'} ${formatRupiah(t.amount)}
        </td>
      </tr>
    `;
  });

  return `
    <div class="print-header" style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
      <div>
        <div class="print-brand" style="font-family: 'Outfit', sans-serif; font-size: 22pt; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">ARTHA</div>
        <div style="font-size: 11pt; font-weight: 700; color: #334155; margin-top: 2px;">Laporan Ringkasan Keuangan Pribadi</div>
        <div style="font-size: 9pt; color: #64748b;">Akun: ${escapeHtml(userEmail)}</div>
      </div>
      <div class="print-meta" style="text-align: right; font-size: 9pt; color: #475569; line-height: 1.4;">
        <div><strong>Periode:</strong> ${periodLabel}</div>
        <div><strong>Tanggal Cetak:</strong> ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div><strong>Status Data:</strong> Terenkripsi Cloud Artha</div>
      </div>
    </div>

    ${fallbackNote ? `
      <div class="btn-print-hide" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; padding: 10px 14px; margin-bottom: 16px; font-size: 8.5pt; color: #166534; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
        <i class="ri-information-line" style="font-size: 1.1rem; color: #10b981;"></i>
        <span>${escapeHtml(fallbackNote)}</span>
      </div>
    ` : ''}

    <div class="print-summary-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div class="print-summary-box" style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
        <div class="print-summary-label" style="font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Pemasukan</div>
        <div class="print-summary-val" style="font-size: 13pt; font-weight: 700; color: #059669; margin-top: 4px;">${formatRupiah(totalIncome)}</div>
      </div>
      <div class="print-summary-box" style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
        <div class="print-summary-label" style="font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Pengeluaran</div>
        <div class="print-summary-val" style="font-size: 13pt; font-weight: 700; color: #e11d48; margin-top: 4px;">${formatRupiah(totalExpense)}</div>
      </div>
      <div class="print-summary-box" style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
        <div class="print-summary-label" style="font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: 600;">Arus Kas Bersih</div>
        <div class="print-summary-val" style="font-size: 13pt; font-weight: 700; color: ${netSavings >= 0 ? '#059669' : '#e11d48'}; margin-top: 4px;">
          ${netSavings >= 0 ? '+' : '-'} ${formatRupiah(Math.abs(netSavings))}
        </div>
      </div>
      <div class="print-summary-box" style="border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background: #f8fafc;">
        <div class="print-summary-label" style="font-size: 8pt; color: #64748b; text-transform: uppercase; font-weight: 600;">Simpanan Orang Tua</div>
        <div class="print-summary-val" style="font-size: 13pt; font-weight: 700; color: #4f46e5; margin-top: 4px;">${formatRupiah(momBal)}</div>
      </div>
    </div>

    ${catRowsHtml ? `
      <div style="font-weight: 700; font-size: 11pt; margin-bottom: 8px; color: #0f172a;">Rincian Pengeluaran per Kategori</div>
      <table class="print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 9pt;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left;">Kategori</th>
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left;">Realisasi Belanja</th>
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left;">Target Anggaran</th>
            <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left;">Realisasi %</th>
          </tr>
        </thead>
        <tbody>
          ${catRowsHtml}
        </tbody>
      </table>
    ` : ''}

    <div style="font-weight: 700; font-size: 11pt; margin-bottom: 8px; color: #0f172a;">Daftar Rincian Transaksi (${txToPrint.length} Transaksi)</div>
    <table class="print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 9pt;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; width: 35px;">No</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; width: 85px;">Tanggal</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; width: 85px;">Jenis</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; width: 120px;">Kategori</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left; width: 110px;">Metode</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: left;">Catatan</th>
          <th style="padding: 6px 8px; border-bottom: 1.5px solid #cbd5e1; text-align: right; width: 110px;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${txRowsHtml || '<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Tidak ada catatan transaksi pada periode ini.</td></tr>'}
      </tbody>
    </table>

    <div class="print-footer" style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 24px; display: flex; justify-content: space-between; font-size: 8pt; color: #64748b;">
      <div>Dokumen ini dihasilkan secara resmi oleh sistem manajemen keuangan Artha (https://www.artha.my.id).</div>
      <div>Halaman Resmi Artha</div>
    </div>
  `;
}

export function openPrintReportModal(preset = 'CURRENT_MONTH') {
  try {
    const previewEl = document.getElementById('printReportDocPreview');
    const periodSelect = document.getElementById('selectPrintReportPeriod');
    const printContainer = document.getElementById('printReportContainer');

    if (periodSelect) periodSelect.value = preset;

    const html = compileFinancialReportHtml(preset);

    if (previewEl) previewEl.innerHTML = html;
    if (printContainer) printContainer.innerHTML = html;

    const modal = document.getElementById('modalPrintReportPreview');
    if (modal) modal.classList.add('active');
  } catch (err) {
    console.error('Error saat membuka pratinjau laporan keuangan:', err);
    showToast('Gagal memuat laporan: ' + err.message, 'danger');
  }
}

export function executePrintDocument() {
  try {
    const previewEl = document.getElementById('printReportDocPreview');
    if (!previewEl) {
      showToast('Konten laporan tidak ditemukan.', 'danger');
      return;
    }

    const reportHtml = previewEl.innerHTML;

    // Open a dedicated print window so window.print() doesn't freeze the app
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      showToast('Popup diblokir browser. Izinkan popup untuk mencetak.', 'warning');
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Keuangan - Artha</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      font-size: 10pt;
      color: #0f172a;
      background: #ffffff;
      padding: 20px;
    }
    .print-preview-sheet {
      max-width: 800px;
      margin: 0 auto;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; }
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .print-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .print-actions button {
      padding: 8px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    .print-actions button:hover { opacity: 0.85; }
    .btn-print { background: #4f46e5; color: #fff; }
    .btn-close { background: #f1f5f9; color: #334155; }
  </style>
</head>
<body>
  <div class="print-actions no-print">
    <button class="btn-close" onclick="window.close()">✕ Tutup</button>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>
  <div class="print-preview-sheet">
    ${reportHtml}
  </div>
  <script>
    // Auto-trigger print dialog after fonts load
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 800);
    });
  <\/script>
</body>
</html>`);

    printWindow.document.close();
    printWindow.focus();

  } catch (err) {
    console.error('Error saat mencetak dokumen:', err);
    showToast('Gagal mencetak: ' + err.message, 'danger');
  }
}

export function generateAndPrintMonthlyReport(filteredOnly = false) {
  openPrintReportModal(filteredOnly ? 'FILTERED' : 'CURRENT_MONTH');
}
