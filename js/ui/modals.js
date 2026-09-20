/* ==========================================================================
   DewpBank - Modals & Backup Utilities Module
   Utilitas Kontrol Modal & Ekspor / Impor Data Cadangan
   ========================================================================== */

import { appState, saveTransactions, saveBudgets, saveMomBalance } from '../state.js';
import { getCategoryObj } from '../utils.js';

let appRenderer = null;
export function setModalsAppRenderer(fn) {
  appRenderer = fn;
}

function triggerRenderApp() {
  if (typeof appRenderer === 'function') {
    appRenderer();
  } else if (typeof window.renderApp === 'function') {
    window.renderApp();
  }
}

export function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

export function exportDataJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `artha-backup-${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportDataCSV() {
  let csvContent = "data:text/csv;charset=utf-8,ID,Jenis,Tanggal,Kategori,Metode,Catatan,Jumlah(IDR)\n";

  (appState.transactions || []).forEach(t => {
    const cat = getCategoryObj(t.category);
    const row = [
      t.id,
      t.type,
      t.date,
      `"${cat.name}"`,
      `"${t.payment || 'Cash'}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.amount
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `artha-transactions-${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function importDataJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.transactions && Array.isArray(data.transactions)) {
        appState.transactions = data.transactions;
        if (data.budgets) appState.budgets = data.budgets;

        saveTransactions();
        saveBudgets();
        closeModal('modalSettings');
        triggerRenderApp();
        alert('Data berhasil dipulihkan!');
      } else {
        alert('Format file JSON tidak valid.');
      }
    } catch (err) {
      alert('Gagal membaca file JSON.');
    }
  };
  reader.readAsText(file);
}

export function clearAllData() {
  if (confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data transaksi? Tindakan ini tidak dapat dibatalkan.')) {
    appState.transactions = [];
    appState.momBalance = 0;
    saveTransactions();
    saveMomBalance();
    closeModal('modalSettings');
    triggerRenderApp();
    alert('Seluruh data transaksi dan simpanan telah di-reset.');
  }
}
