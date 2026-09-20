/* ==========================================================================
   DewpBank - Debts Module
   Manajemen Catatan Hutang & Piutang (CRUD, Pelunasan, Filter, Badge)
   ========================================================================== */

import { appState, saveDebts } from '../state.js';
import { formatRupiah, formatDate, escapeHtml } from '../utils.js';
import { openModal, closeModal } from '../ui/modals.js';

export function renderDebts() {
  const container = document.getElementById('debtsListContainer');
  const countBadge = document.getElementById('badgeDebtsCount');
  const valTotalOwed = document.getElementById('valTotalDebtsOwed');
  const valTotalReceivable = document.getElementById('valTotalLoansReceivable');
  const valNetBalance = document.getElementById('valNetDebtBalance');
  const subOwed = document.getElementById('subTotalDebtsOwed');
  const subReceivable = document.getElementById('subTotalLoansReceivable');

  const debts = appState.debts || [];

  let totalOwed = 0;
  let countOwed = 0;
  let totalReceivable = 0;
  let countReceivable = 0;

  debts.forEach(d => {
    const amt = Number(d.amount) || 0;
    if (!d.isPaid) {
      if (d.type === 'DEBT') {
        totalOwed += amt;
        countOwed++;
      } else if (d.type === 'LOAN') {
        totalReceivable += amt;
        countReceivable++;
      }
    }
  });

  const netBalance = totalReceivable - totalOwed;

  if (valTotalOwed) valTotalOwed.textContent = formatRupiah(totalOwed);
  if (subOwed) subOwed.textContent = `${countOwed} catatan belum lunas`;

  if (valTotalReceivable) valTotalReceivable.textContent = formatRupiah(totalReceivable);
  if (subReceivable) subReceivable.textContent = `${countReceivable} catatan belum lunas`;

  if (valNetBalance) {
    valNetBalance.textContent = (netBalance >= 0 ? '+ ' : '- ') + formatRupiah(Math.abs(netBalance));
    valNetBalance.style.color = netBalance >= 0 ? 'var(--income-green)' : 'var(--expense-red)';
  }

  const activeFilter = appState.debtsFilter || 'ALL';
  const filteredDebts = debts.filter(d => {
    if (activeFilter === 'DEBT') return d.type === 'DEBT';
    if (activeFilter === 'LOAN') return d.type === 'LOAN';
    if (activeFilter === 'UNPAID') return !d.isPaid;
    if (activeFilter === 'PAID') return d.isPaid;
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filteredDebts.length} dari ${debts.length} Catatan`;
  }

  if (!container) return;

  if (filteredDebts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--surface-subtle); border-radius: var(--radius-md); border: 1px dashed var(--border-card);">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-full); background: var(--surface-card); margin: 0 auto 0.75rem auto; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--warning-amber); box-shadow: var(--shadow-sm); border: 1px solid var(--border-card);">
          <i class="ri-hand-coin-line"></i>
        </div>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Belum Ada Catatan Hutang / Piutang</div>
        <div style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Catat kewajiban atau pinjaman agar keuangan Anda selalu tertib dan transparan.</div>
        <button class="glass-button primary-cta" onclick="openAddDebtModal()">
          <i class="ri-add-line"></i> Buat Catatan Pertama
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  filteredDebts.forEach(d => {
    const isDebt = d.type === 'DEBT';
    const isPaid = Boolean(d.isPaid);
    const initial = (d.personName || 'O').charAt(0).toUpperCase();

    let dueDateStr = '';
    if (d.dueDate) {
      const diffDays = Math.ceil((new Date(d.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (isPaid) {
        dueDateStr = `<span style="color: var(--income-green); font-size: 0.75rem;"><i class="ri-checkbox-circle-line"></i> Lunas</span>`;
      } else if (diffDays < 0) {
        dueDateStr = `<span style="color: var(--expense-red); font-size: 0.75rem; font-weight: 600;"><i class="ri-alarm-warning-line"></i> Lewat ${Math.abs(diffDays)} hari</span>`;
      } else if (diffDays === 0) {
        dueDateStr = `<span style="color: var(--warning-amber); font-size: 0.75rem; font-weight: 600;"><i class="ri-time-line"></i> Hari Ini</span>`;
      } else {
        dueDateStr = `<span style="color: var(--text-muted); font-size: 0.75rem;"><i class="ri-calendar-line"></i> Jatuh tempo: ${formatDate(d.dueDate)}</span>`;
      }
    }

    html += `
      <div class="debt-card ${isDebt ? 'debt-type-debt' : 'debt-type-loan'} ${isPaid ? 'debt-paid' : ''}">
        <div class="debt-card-header">
          <div class="debt-person-info">
            <div class="debt-avatar">${initial}</div>
            <div>
              <div class="debt-person-name">${escapeHtml(d.personName)}</div>
              <div style="margin-top: 0.2rem;">
                <span class="debt-badge-type ${isDebt ? 'debt' : 'loan'}">
                  ${isDebt ? 'Hutang Saya' : 'Piutang Saya'}
                </span>
              </div>
            </div>
          </div>
          <span class="debt-status-tag ${isPaid ? 'paid' : 'unpaid'}">
            ${isPaid ? 'Sudah Lunas' : 'Belum Lunas'}
          </span>
        </div>

        <div class="debt-amount-row">
          <span class="debt-amount-val">${formatRupiah(d.amount)}</span>
          ${dueDateStr}
        </div>

        ${d.note ? `<div class="debt-note-text">${escapeHtml(d.note)}</div>` : ''}

        <div class="debt-card-actions">
          <button type="button" class="glass-button ${isPaid ? 'secondary' : 'primary-cta'}" onclick="toggleDebtPaidStatus('${d.id}')" style="flex: 1;">
            <i class="${isPaid ? 'ri-arrow-go-back-line' : 'ri-check-line'}"></i>
            <span>${isPaid ? 'Batal Lunas' : 'Tandai Lunas'}</span>
          </button>
          <button type="button" class="action-btn edit-btn" onclick="openAddDebtModal('${d.id}')" title="Edit Catatan">
            <i class="ri-pencil-line"></i>
          </button>
          <button type="button" class="action-btn delete-btn" onclick="deleteDebt('${d.id}')" title="Hapus Catatan">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function openAddDebtModal(debtId = null) {
  const form = document.getElementById('formDebt');
  if (form) form.reset();

  const titleEl = document.getElementById('modalDebtTitle');
  const idInput = document.getElementById('debtRecordId');
  const btnDebt = document.getElementById('btnDebtTypeDebt');
  const btnLoan = document.getElementById('btnDebtTypeLoan');
  const typeVal = document.getElementById('debtTypeVal');

  if (debtId) {
    const debt = (appState.debts || []).find(d => d.id === debtId);
    if (debt) {
      if (titleEl) titleEl.innerHTML = '<i class="ri-hand-coin-line" style="color: var(--warning-amber);"></i> <span>Edit Catatan Hutang / Piutang</span>';
      if (idInput) idInput.value = debt.id;
      const nameIn = document.getElementById('debtPersonName');
      const amtIn = document.getElementById('debtAmount');
      const dateIn = document.getElementById('debtDueDate');
      const noteIn = document.getElementById('debtNote');

      if (nameIn) nameIn.value = debt.personName;
      if (amtIn) amtIn.value = debt.amount;
      if (dateIn) dateIn.value = debt.dueDate || '';
      if (noteIn) noteIn.value = debt.note || '';

      if (typeVal) typeVal.value = debt.type;
      if (debt.type === 'LOAN') {
        btnLoan?.classList.add('active', 'income');
        btnDebt?.classList.remove('active', 'expense');
      } else {
        btnDebt?.classList.add('active', 'expense');
        btnLoan?.classList.remove('active', 'income');
      }
    }
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="ri-hand-coin-line" style="color: var(--warning-amber);"></i> <span>Catat Hutang / Piutang Baru</span>';
    if (idInput) idInput.value = '';
    if (typeVal) typeVal.value = 'DEBT';
    btnDebt?.classList.add('active', 'expense');
    btnLoan?.classList.remove('active', 'income');
  }

  openModal('modalDebt');
}

export function handleSaveDebt(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('debtRecordId')?.value;
  const type = document.getElementById('debtTypeVal')?.value || 'DEBT';
  const personName = (document.getElementById('debtPersonName')?.value || '').trim();
  const amount = Number(document.getElementById('debtAmount')?.value) || 0;
  const dueDate = document.getElementById('debtDueDate')?.value || '';
  const note = (document.getElementById('debtNote')?.value || '').trim();

  if (!personName) {
    alert('Harap masukkan nama pihak atau kontak.');
    return;
  }
  if (amount <= 0) {
    alert('Nominal harus lebih dari 0.');
    return;
  }

  if (id) {
    const idx = (appState.debts || []).findIndex(d => d.id === id);
    if (idx !== -1) {
      appState.debts[idx] = {
        ...appState.debts[idx],
        type,
        personName,
        amount,
        dueDate,
        note,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    const newDebt = {
      id: 'debt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type,
      personName,
      amount,
      dueDate,
      isPaid: false,
      note,
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(appState.debts)) appState.debts = [];
    appState.debts.unshift(newDebt);
  }

  saveDebts();
  closeModal('modalDebt');
  renderDebts();
}

export function toggleDebtPaidStatus(debtId) {
  const debt = (appState.debts || []).find(d => d.id === debtId);
  if (!debt) return;

  debt.isPaid = !debt.isPaid;
  debt.updatedAt = new Date().toISOString();
  saveDebts();
  renderDebts();
}

export function deleteDebt(debtId) {
  if (!debtId) return;
  const debt = (appState.debts || []).find(d => d.id === debtId);
  const name = debt ? debt.personName : 'catatan ini';

  if (confirm(`Apakah Anda yakin ingin menghapus catatan untuk "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
    appState.debts = (appState.debts || []).filter(d => d.id !== debtId);
    saveDebts();
    renderDebts();
  }
}
