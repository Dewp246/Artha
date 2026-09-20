/* ==========================================================================
   DewpBank - Transactions Module
   Manajemen Transaksi (CRUD, Filter, Tabel, Metrik, Saluran Pembayaran)
   ========================================================================== */

import { CATEGORIES } from '../config.js';
import { appState, saveTransactions, addDeletedId } from '../state.js';
import { formatRupiah, formatDate, getCategoryObj, escapeHtml } from '../utils.js';
import { deleteFromSupabase } from '../api/sync.js';
import { openModal, closeModal } from '../ui/modals.js';

let appRenderer = null;
export function setAppRenderer(fn) {
  appRenderer = fn;
}

function triggerRenderApp() {
  if (typeof appRenderer === 'function') {
    appRenderer();
  } else if (typeof window.renderApp === 'function') {
    window.renderApp();
  }
}

export function populateCategorySelects() {
  const modalCategorySelect = document.getElementById('txCategory');
  const filterCategorySelect = document.getElementById('filterCategorySelect');
  const currentType = document.getElementById('txType')?.value || 'EXPENSE';

  if (modalCategorySelect) {
    const list = currentType === 'EXPENSE' ? CATEGORIES.EXPENSE : CATEGORIES.INCOME;
    modalCategorySelect.innerHTML = list.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  if (filterCategorySelect) {
    const allCats = [...CATEGORIES.EXPENSE, ...CATEGORIES.INCOME];
    filterCategorySelect.innerHTML = '<option value="ALL">Semua Kategori</option>' +
      allCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

export function renderDashboardRecentTx() {
  const container = document.getElementById('dashboardRecentTxList');
  if (!container) return;

  const recent = (appState.transactions || []).slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.875rem; background: var(--surface-subtle); border-radius: var(--radius-md); border: 1px dashed var(--border-card);">
        <div style="width: 44px; height: 44px; border-radius: var(--radius-full); background: var(--surface-card); margin: 0 auto 0.75rem auto; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; color: var(--brand-accent); box-shadow: var(--shadow-sm); border: 1px solid var(--border-card);">
          <i class="ri-receipt-line"></i>
        </div>
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Belum Ada Transaksi</div>
        <div style="font-size: 0.825rem; margin-bottom: 1.25rem; color: var(--text-secondary);">Mulai catat pemasukan atau pengeluaran harianmu.</div>
        <button class="glass-button secondary" onclick="openAddTxModal()" style="padding: 0.45rem 1rem; font-size: 0.825rem;">
          <i class="ri-add-line"></i> Tambah Transaksi Pertama
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  recent.forEach(tx => {
    const cat = getCategoryObj(tx.category);
    const isIncome = tx.type === 'INCOME';
    const amountColor = isIncome ? 'var(--income-green)' : 'var(--expense-red)';
    const amountSign = isIncome ? '+' : '-';
    const paymentLabel = tx.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (tx.payment || 'Tunai / Cash');
    const safeNote = tx.note ? escapeHtml(tx.note) : '';

    html += `
      <div class="recent-tx-item">
        <div class="recent-tx-left">
          <div class="recent-tx-icon" style="background: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}25;">
            <i class="${cat.icon}"></i>
          </div>
          <div class="recent-tx-info">
            <div class="recent-tx-title-row">
              <span class="recent-tx-title">${safeNote || cat.name}</span>
              ${safeNote ? `
                <span class="recent-tx-cat-badge" style="background: ${cat.color}15; color: ${cat.color}; border: 1px solid ${cat.color}30;">
                  <i class="${cat.icon}"></i> ${cat.name}
                </span>
              ` : ''}
            </div>
            <div class="recent-tx-meta">
              <span><i class="ri-calendar-line"></i> ${formatDate(tx.date)}</span>
              <span class="meta-dot">•</span>
              <span><i class="ri-wallet-3-line"></i> ${paymentLabel}</span>
            </div>
          </div>
        </div>
        <div class="recent-tx-right">
          <div class="recent-tx-amount-col">
            <div class="tabular-nums recent-tx-amount" style="color: ${amountColor};">
              ${amountSign} ${formatRupiah(tx.amount)}
            </div>
            <div class="recent-tx-type-tag ${isIncome ? 'income' : 'expense'}">
              ${isIncome ? 'Pemasukan' : 'Pengeluaran'}
            </div>
          </div>
          <div class="recent-tx-actions">
            <button class="action-btn edit-btn" onclick="editTransaction('${tx.id}')" title="Edit Transaksi">
              <i class="ri-pencil-line"></i>
              <span>Edit</span>
            </button>
            <button class="action-btn delete-btn" onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi">
              <i class="ri-delete-bin-line"></i>
              <span>Hapus</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderMetrics() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalIncomeMonth = 0;
  let totalExpenseMonth = 0;
  let netBalanceAllTime = 0;

  (appState.transactions || []).forEach(tx => {
    const txDate = new Date(tx.date);
    const amount = Number(tx.amount) || 0;

    if (tx.type === 'INCOME') {
      netBalanceAllTime += amount;
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        totalIncomeMonth += amount;
      }
    } else {
      netBalanceAllTime -= amount;
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        totalExpenseMonth += amount;
      }
    }
  });

  const netSavingsMonth = totalIncomeMonth - totalExpenseMonth;

  const elNetBalance = document.getElementById('valNetBalance');
  const elTotalIncome = document.getElementById('valTotalIncome');
  const elTotalExpense = document.getElementById('valTotalExpense');
  const elNetSavings = document.getElementById('valNetSavings');
  const elMomBalance = document.getElementById('valMomBalance');

  if (elNetBalance) elNetBalance.textContent = formatRupiah(netBalanceAllTime);
  if (elTotalIncome) elTotalIncome.textContent = formatRupiah(totalIncomeMonth);
  if (elTotalExpense) elTotalExpense.textContent = formatRupiah(totalExpenseMonth);
  if (elNetSavings) elNetSavings.textContent = formatRupiah(netSavingsMonth);
  if (elMomBalance) elMomBalance.textContent = formatRupiah(appState.momBalance || 0);
}

export function renderPaymentChannels() {
  const container = document.getElementById('paymentChannelBreakdown');
  if (!container) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const channelMap = {
    'Tunai / Cash': { icon: 'ri-money-cny-box-line', color: '#10b981', total: 0, count: 0 },
    'Transfer Bank': { icon: 'ri-bank-line', color: '#3b82f6', total: 0, count: 0 },
    'QRIS / E-Wallet': { icon: 'ri-qr-code-line', color: '#06b6d4', total: 0, count: 0 },
    'Uang di Orang Tua': { icon: 'ri-parent-line', color: '#db2777', total: 0, count: 0 },
    'Lainnya': { icon: 'ri-wallet-3-line', color: '#64748b', total: 0, count: 0 }
  };

  let totalExpenseMonth = 0;

  (appState.transactions || []).forEach(tx => {
    const txDate = new Date(tx.date);
    if (tx.type === 'EXPENSE' && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      const amount = Number(tx.amount) || 0;
      totalExpenseMonth += amount;

      let channelKey = 'Lainnya';
      const p = (tx.payment || '').toLowerCase();
      if (p.includes('tunai') || p.includes('cash')) channelKey = 'Tunai / Cash';
      else if (p.includes('bank') || p.includes('bca') || p.includes('mandiri') || p.includes('transfer')) channelKey = 'Transfer Bank';
      else if (p.includes('qris') || p.includes('gopay') || p.includes('ovo') || p.includes('shopeepay') || p.includes('wallet')) channelKey = 'QRIS / E-Wallet';
      else if (p.includes('orang tua') || p.includes('mama')) channelKey = 'Uang di Orang Tua';

      channelMap[channelKey].total += amount;
      channelMap[channelKey].count += 1;
    }
  });

  const channels = Object.keys(channelMap)
    .filter(k => channelMap[k].total > 0 || k === 'Tunai / Cash' || k === 'QRIS / E-Wallet')
    .sort((a, b) => channelMap[b].total - channelMap[a].total);

  if (channels.length === 0 || totalExpenseMonth === 0) {
    container.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        <i class="ri-pie-chart-line" style="font-size: 1.75rem; display: block; margin-bottom: 0.5rem; opacity: 0.6;"></i>
        Belum ada transaksi pengeluaran bulan ini.
      </div>
    `;
    return;
  }

  let html = '';
  channels.forEach(key => {
    const ch = channelMap[key];
    const pct = totalExpenseMonth > 0 ? Math.round((ch.total / totalExpenseMonth) * 100) : 0;

    html += `
      <div class="channel-item" style="padding: 0.65rem 0; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <span style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 500; font-size: 0.85rem; color: var(--text-primary);">
            <span style="width: 28px; height: 28px; border-radius: var(--radius-xs); background: ${ch.color}15; color: ${ch.color}; display: inline-flex; align-items: center; justify-content: center; font-size: 0.95rem;">
              <i class="${ch.icon}"></i>
            </span>
            ${key}
          </span>
          <div style="text-align: right;">
            <span class="tabular-nums" style="font-weight: 600; font-size: 0.875rem; color: var(--text-primary);">${formatRupiah(ch.total)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.35rem;">(${pct}%)</span>
          </div>
        </div>
        <div class="progress-bar-bg" style="height: 4px; background: var(--surface-subtle); border-radius: 2px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: ${ch.color}; border-radius: 2px; transition: width 0.3s ease;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function renderTransactionsTable() {
  const tbody = document.getElementById('txTableBody');
  if (!tbody) return;

  const searchQuery = (document.getElementById('searchTxInput')?.value || '').toLowerCase().trim();
  const filterType = document.getElementById('filterTypeSelect')?.value || 'ALL';
  const filterCategory = document.getElementById('filterCategorySelect')?.value || 'ALL';
  const filterPayment = document.getElementById('filterPaymentSelect')?.value || 'ALL';
  const datePreset = appState.txDatePreset || 'ALL';
  const dateStart = document.getElementById('txFilterDateStart')?.value;
  const dateEnd = document.getElementById('txFilterDateEnd')?.value;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let sumIncome = 0;
  let sumExpense = 0;

  // Filter transactions
  let filtered = (appState.transactions || []).filter(tx => {
    const cat = getCategoryObj(tx.category);
    const paymentStr = tx.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (tx.payment || 'Tunai / Cash');
    
    // 1. Search Query Match
    const matchesSearch = !searchQuery ||
                          (tx.note || '').toLowerCase().includes(searchQuery) ||
                          cat.name.toLowerCase().includes(searchQuery) ||
                          paymentStr.toLowerCase().includes(searchQuery) ||
                          String(tx.amount).includes(searchQuery);
    
    // 2. Type Match
    const matchesType = filterType === 'ALL' || tx.type === filterType;

    // 3. Category Match
    const matchesCat = filterCategory === 'ALL' || tx.category === filterCategory;

    // 4. Payment Match
    let matchesPayment = true;
    if (filterPayment !== 'ALL') {
      if (filterPayment === 'Uang di Orang Tua') {
        matchesPayment = tx.payment === 'Uang di Orang Tua' || tx.payment === 'Uang di Mama';
      } else {
        matchesPayment = tx.payment === filterPayment;
      }
    }

    // 5. Date Range Match
    let matchesDate = true;
    const txDate = new Date(tx.date);
    if (datePreset === 'THIS_MONTH') {
      matchesDate = txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    } else if (datePreset === 'LAST_30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      matchesDate = txDate >= thirtyDaysAgo;
    } else if (datePreset === 'CUSTOM') {
      if (dateStart) {
        const start = new Date(dateStart + 'T00:00:00');
        matchesDate = matchesDate && txDate >= start;
      }
      if (dateEnd) {
        const end = new Date(dateEnd + 'T23:59:59');
        matchesDate = matchesDate && txDate <= end;
      }
    }

    const matched = matchesSearch && matchesType && matchesCat && matchesPayment && matchesDate;
    if (matched) {
      if (tx.type === 'INCOME') sumIncome += Number(tx.amount) || 0;
      else sumExpense += Number(tx.amount) || 0;
    }
    return matched;
  });

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const countBadge = document.getElementById('txCountBadge');
  if (countBadge) {
    countBadge.textContent = `Menampilkan ${filtered.length} dari ${(appState.transactions || []).length} transaksi`;
  }

  // Summary badges update
  const badgeIncome = document.getElementById('badgeTxSumIncome');
  const badgeExpense = document.getElementById('badgeTxSumExpense');
  const btnReset = document.getElementById('btnResetTxFilter');

  const hasFilterActive = searchQuery || filterType !== 'ALL' || filterCategory !== 'ALL' || filterPayment !== 'ALL' || datePreset !== 'ALL';
  if (btnReset) {
    btnReset.style.display = hasFilterActive ? 'inline-flex' : 'none';
  }

  if (badgeIncome) {
    badgeIncome.style.display = sumIncome > 0 ? 'inline-block' : 'none';
    badgeIncome.textContent = `Masuk: ${formatRupiah(sumIncome)}`;
  }
  if (badgeExpense) {
    badgeExpense.style.display = sumExpense > 0 ? 'inline-block' : 'none';
    badgeExpense.textContent = `Keluar: ${formatRupiah(sumExpense)}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <i class="ri-inbox-archive-line" style="font-size: 2.25rem; display: block; margin-bottom: 0.5rem; opacity: 0.6;"></i>
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">Tidak Ada Transaksi Sesuai Filter</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);">Coba sesuaikan kata kunci pencarian atau rentang filter Anda.</div>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  filtered.forEach(tx => {
    const cat = getCategoryObj(tx.category);
    const isIncome = tx.type === 'INCOME';
    const amountColor = isIncome ? 'var(--income-green)' : 'var(--expense-red)';
    const amountSign = isIncome ? '+' : '-';
    const paymentLabel = tx.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (tx.payment || 'Tunai / Cash');

    html += `
      <tr>
        <td class="tabular-nums" style="color: var(--text-secondary); font-size: 0.825rem; white-space: nowrap;">${formatDate(tx.date)}</td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 500;">
            <i class="${cat.icon}" style="color: ${cat.color}; font-size: 1rem;"></i>
            <span>${cat.name}</span>
          </span>
        </td>
        <td><span style="color: var(--text-secondary); font-size: 0.825rem;">${paymentLabel}</span></td>
        <td style="color: var(--text-primary); font-size: 0.85rem;">${tx.note ? escapeHtml(tx.note) : '<span style="color: var(--text-muted);">-</span>'}</td>
        <td>
          <span class="tabular-nums" style="font-weight: 600; color: ${amountColor};">
            ${amountSign} ${formatRupiah(tx.amount)}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: inline-flex; align-items: center; gap: 0.4rem; justify-content: flex-end;">
            <button class="action-btn edit-btn" onclick="editTransaction('${tx.id}')" title="Edit Transaksi">
              <i class="ri-pencil-line"></i>
              <span>Edit</span>
            </button>
            <button class="action-btn delete-btn" onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi">
              <i class="ri-delete-bin-line"></i>
              <span>Hapus</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

export function openAddTxModal(editId = null) {
  const form = document.getElementById('formTransaction');
  if (form) form.reset();

  const now = new Date();
  const isoLocal = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  const txDateInput = document.getElementById('txDate');
  if (txDateInput) txDateInput.value = isoLocal;

  if (editId) {
    const tx = (appState.transactions || []).find(t => t.id === editId);
    if (tx) {
      const modalTitle = document.getElementById('modalTxTitle');
      if (modalTitle) modalTitle.textContent = 'Edit Transaksi';
      const txIdInput = document.getElementById('txId');
      if (txIdInput) txIdInput.value = tx.id;
      const txAmountInput = document.getElementById('txAmount');
      if (txAmountInput) txAmountInput.value = tx.amount;
      const txPaymentInput = document.getElementById('txPayment');
      if (txPaymentInput) txPaymentInput.value = tx.payment === 'Uang di Mama' ? 'Uang di Orang Tua' : (tx.payment || 'Tunai / Cash');
      const txNoteInput = document.getElementById('txNote');
      if (txNoteInput) txNoteInput.value = tx.note || '';

      const d = new Date(tx.date);
      if (txDateInput) txDateInput.value = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

      if (tx.type === 'INCOME') {
        document.getElementById('btnToggleIncome')?.click();
      } else {
        document.getElementById('btnToggleExpense')?.click();
      }
      const catSelect = document.getElementById('txCategory');
      if (catSelect) catSelect.value = tx.category;
    }
  } else {
    const modalTitle = document.getElementById('modalTxTitle');
    if (modalTitle) modalTitle.textContent = 'Tambah Transaksi Baru';
    const txIdInput = document.getElementById('txId');
    if (txIdInput) txIdInput.value = '';
    document.getElementById('btnToggleExpense')?.click();
  }

  openModal('modalTransaction');
}

export async function handleSaveTransaction(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('txId')?.value;
  const type = document.getElementById('txType')?.value || 'EXPENSE';
  const amount = Number(document.getElementById('txAmount')?.value);
  const category = document.getElementById('txCategory')?.value;
  const payment = document.getElementById('txPayment')?.value;
  const dateStr = document.getElementById('txDate')?.value;
  const note = (document.getElementById('txNote')?.value || '').trim();

  if (!amount || amount <= 0) {
    alert('Jumlah transaksi harus lebih dari 0!');
    return;
  }

  let finalTx = null;
  if (id) {
    // Edit existing
    const idx = (appState.transactions || []).findIndex(t => t.id === id);
    if (idx !== -1) {
      finalTx = { id, type, amount, category, payment: payment || 'Tunai / Cash', date: new Date(dateStr).toISOString(), note };
      appState.transactions[idx] = finalTx;
    }
  } else {
    // Create new
    finalTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      amount,
      category,
      payment: payment || 'Tunai / Cash',
      date: new Date(dateStr).toISOString(),
      note
    };
    if (!Array.isArray(appState.transactions)) appState.transactions = [];
    appState.transactions.unshift(finalTx);
  }

  // 1. Simpan ke LocalStorage user & Supabase Cloud
  saveTransactions();

  // 2. Tutup modal & perbarui seluruh tampilan antarmuka seketika
  closeModal('modalTransaction');
  triggerRenderApp();
}

export function editTransaction(id) {
  openAddTxModal(id);
}

export async function deleteTransaction(id) {
  if (!id) return;
  if (confirm('Apakah Anda yakin ingin menghapus transaksi ini dari catatan? Tindakan ini tidak dapat dibatalkan.')) {
    addDeletedId(id);
    appState.transactions = (appState.transactions || []).filter(t => t.id !== id);
    saveTransactions();
    triggerRenderApp();
    await deleteFromSupabase(id);
  }
}
