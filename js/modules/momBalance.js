/* ==========================================================================
   DewpBank - Simpanan di Orang Tua (Uang di Mama) Module
   ========================================================================== */

import { appState, saveMomBalanceLocal, saveTransactionsLocal } from '../state.js';
import { pushToSupabase } from '../api/sync.js';
import { formatRupiah } from '../utils.js';

export function openMomModal() {
  const modalVal = document.getElementById('modalMomBalanceVal');
  const directInput = document.getElementById('momDirectAmount');
  if (modalVal) modalVal.textContent = formatRupiah(appState.momBalance || 0);
  if (directInput) directInput.value = appState.momBalance || 0;

  const modal = document.getElementById('modalMomMoney');
  if (modal) modal.classList.add('active');
}

export function handleWithdrawMom(onRender) {
  const input = document.getElementById('momWithdrawAmount');
  const amount = Number(input?.value || 0);
  if (amount <= 0) {
    alert('Masukkan nominal uang yang ditarik/diberikan Orang Tua.');
    return;
  }

  if (amount > appState.momBalance) {
    if (!confirm(`Nominal (${formatRupiah(amount)}) melebihi saldo di Orang Tua (${formatRupiah(appState.momBalance)}). Lanjutkan?`)) {
      return;
    }
  }

  appState.momBalance = Math.max(0, appState.momBalance - amount);
  saveMomBalanceLocal();
  pushToSupabase();

  const newTx = {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    type: 'INCOME',
    amount: amount,
    category: 'cat_gift',
    payment: 'Uang di Orang Tua',
    date: new Date().toISOString(),
    note: 'Uang ditarik/diberikan dari Simpanan Orang Tua'
  };
  appState.transactions.unshift(newTx);
  saveTransactionsLocal();
  pushToSupabase();

  if (input) input.value = '';
  const modal = document.getElementById('modalMomMoney');
  if (modal) modal.classList.remove('active');

  if (typeof onRender === 'function') onRender();
  alert(`Berhasil menarik ${formatRupiah(amount)} dari simpanan Orang Tua ke saldo aktif!`);
}

export function handleDepositMom(onRender) {
  const input = document.getElementById('momDepositAmount');
  const amount = Number(input?.value || 0);
  if (amount <= 0) {
    alert('Masukkan nominal uang yang dititipkan ke Orang Tua.');
    return;
  }

  appState.momBalance += amount;
  saveMomBalanceLocal();
  pushToSupabase();

  if (input) input.value = '';
  const modal = document.getElementById('modalMomMoney');
  if (modal) modal.classList.remove('active');

  if (typeof onRender === 'function') onRender();
  alert(`Berhasil menambah titipan ${formatRupiah(amount)} ke simpanan Orang Tua!`);
}

export function handleSetMomBalance(onRender) {
  const input = document.getElementById('momDirectAmount');
  const amount = Number(input?.value || 0);
  if (amount < 0) {
    alert('Saldo tidak boleh minus.');
    return;
  }

  appState.momBalance = amount;
  saveMomBalanceLocal();
  pushToSupabase();

  const modal = document.getElementById('modalMomMoney');
  if (modal) modal.classList.remove('active');

  if (typeof onRender === 'function') onRender();
  alert(`Saldo Uang di Orang Tua berhasil diperbarui menjadi ${formatRupiah(amount)}!`);
}
