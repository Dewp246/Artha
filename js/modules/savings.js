/* ==========================================================================
   DewpBank - Savings Goals Module
   Manajemen Target Celengan Impian & Wishlist (CRUD, Setor, Tarik, Progress)
   ========================================================================== */

import { appState, saveSavingsGoals } from '../state.js';
import { formatRupiah, escapeHtml } from '../utils.js';
import { openModal, closeModal } from '../ui/modals.js';

export function renderSavingsGoals() {
  const container = document.getElementById('savingsGoalsListContainer');
  const countBadge = document.getElementById('badgeSavingsGoalsCount');
  const valTotalAcc = document.getElementById('valSavingsTotalAccumulated');
  const valTotalTarget = document.getElementById('valSavingsTotalTarget');
  const valOverallPct = document.getElementById('valSavingsOverallPercent');

  const goals = appState.savingsGoals || [];

  let totalAcc = 0;
  let totalTarget = 0;
  goals.forEach(g => {
    totalAcc += Number(g.currentAmount) || 0;
    totalTarget += Number(g.targetAmount) || 0;
  });

  const overallPct = totalTarget > 0 ? Math.round((totalAcc / totalTarget) * 100) : 0;

  if (valTotalAcc) valTotalAcc.textContent = formatRupiah(totalAcc);
  if (valTotalTarget) valTotalTarget.textContent = formatRupiah(totalTarget);
  if (valOverallPct) valOverallPct.textContent = `${overallPct}%`;

  const activeFilter = appState.savingsFilter || 'ALL';
  const filteredGoals = goals.filter(g => {
    const cur = Number(g.currentAmount) || 0;
    const tgt = Number(g.targetAmount) || 0;
    const isAchieved = tgt > 0 && cur >= tgt;
    if (activeFilter === 'IN_PROGRESS') return !isAchieved;
    if (activeFilter === 'ACHIEVED') return isAchieved;
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filteredGoals.length} dari ${goals.length} Impian`;
  }

  if (!container) return;

  if (filteredGoals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--surface-subtle); border-radius: var(--radius-md); border: 1px dashed var(--border-card);">
        <div style="width: 48px; height: 48px; border-radius: var(--radius-full); background: var(--surface-card); margin: 0 auto 0.75rem auto; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--brand-accent); box-shadow: var(--shadow-sm); border: 1px solid var(--border-card);">
          <i class="ri-copper-coin-line"></i>
        </div>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">Belum Ada Target Impian</div>
        <div style="font-size: 0.825rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Rencanakan pembelian barang impian atau dana darurat Anda sekarang.</div>
        <button class="glass-button primary-cta" onclick="openAddSavingsGoalModal()">
          <i class="ri-add-line"></i> Buat Target Impian Pertama
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  filteredGoals.forEach(g => {
    const current = Number(g.currentAmount) || 0;
    const target = Number(g.targetAmount) || 1;
    const pct = Math.min(100, Math.round((current / target) * 100));
    const isAchieved = current >= target;

    let deadlineBadge = '';
    if (g.targetDate) {
      const diffTime = new Date(g.targetDate) - new Date();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (isAchieved) {
        deadlineBadge = '<span class="badge income"><i class="ri-check-line"></i> Tercapai</span>';
      } else if (diffDays > 0) {
        deadlineBadge = `<span class="savings-days-badge"><i class="ri-time-line"></i> Sisa ${diffDays} hari</span>`;
      } else if (diffDays === 0) {
        deadlineBadge = '<span class="savings-days-badge" style="color: var(--warning-amber);"><i class="ri-alarm-warning-line"></i> Hari Ini</span>';
      } else {
        deadlineBadge = `<span class="savings-days-badge" style="color: var(--expense-red);"><i class="ri-error-warning-line"></i> Lewat ${Math.abs(diffDays)} hari</span>`;
      }
    }

    html += `
      <div class="savings-card ${isAchieved ? 'achieved' : ''}">
        <div class="savings-card-top">
          <div class="savings-title-wrap">
            <div class="savings-goal-title">
              <i class="ri-copper-coin-fill" style="color: ${isAchieved ? 'var(--income-green)' : 'var(--brand-accent)'};"></i>
              <span>${escapeHtml(g.title)}</span>
            </div>
            <span class="savings-category-tag">${escapeHtml(g.category || 'Tabungan')}</span>
          </div>
          <span class="badge ${isAchieved ? 'income' : 'neutral'}">${pct}%</span>
        </div>

        <div class="savings-progress-wrap">
          <div class="savings-progress-info">
            <span class="savings-current-val">${formatRupiah(current)}</span>
            <span class="savings-target-val">dari ${formatRupiah(target)}</span>
          </div>
          <div class="savings-bar-track">
            <div class="savings-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>

        <div class="savings-meta-row">
          <span>${deadlineBadge || '<span style="color: var(--text-muted);">Tanpa tenggat</span>'}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Sisa: ${formatRupiah(Math.max(0, target - current))}</span>
        </div>

        ${g.note ? `<div style="font-size: 0.775rem; color: var(--text-secondary); line-height: 1.4; background: var(--surface-subtle); padding: 0.4rem 0.6rem; border-radius: var(--radius-xs);">${escapeHtml(g.note)}</div>` : ''}

        <div class="savings-card-actions">
          <button type="button" class="glass-button" onclick="openDepositGoalModal('${g.id}')" style="flex: 1;">
            <i class="ri-hand-coin-line"></i> Setor / Tarik
          </button>
          <button type="button" class="action-btn edit-btn" onclick="openAddSavingsGoalModal('${g.id}')" title="Edit Target">
            <i class="ri-pencil-line"></i>
          </button>
          <button type="button" class="action-btn delete-btn" onclick="deleteSavingsGoal('${g.id}')" title="Hapus Target">
            <i class="ri-delete-bin-line"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function openAddSavingsGoalModal(goalId = null) {
  const form = document.getElementById('formSavingsGoal');
  if (form) form.reset();

  const titleEl = document.getElementById('modalSavingsGoalTitle');
  const idInput = document.getElementById('savingsGoalId');

  if (goalId) {
    const goal = (appState.savingsGoals || []).find(g => g.id === goalId);
    if (goal) {
      if (titleEl) titleEl.innerHTML = '<i class="ri-copper-coin-fill" style="color: var(--brand-accent);"></i> <span>Edit Target Impian</span>';
      if (idInput) idInput.value = goal.id;
      const titleIn = document.getElementById('savingsGoalTitle');
      const targetIn = document.getElementById('savingsGoalTargetAmount');
      const currentIn = document.getElementById('savingsGoalCurrentAmount');
      const catIn = document.getElementById('savingsGoalCategory');
      const dateIn = document.getElementById('savingsGoalTargetDate');
      const noteIn = document.getElementById('savingsGoalNote');

      if (titleIn) titleIn.value = goal.title;
      if (targetIn) targetIn.value = goal.targetAmount;
      if (currentIn) currentIn.value = goal.currentAmount || 0;
      if (catIn) catIn.value = goal.category || 'Elektronik & Gadget';
      if (dateIn) dateIn.value = goal.targetDate || '';
      if (noteIn) noteIn.value = goal.note || '';
    }
  } else {
    if (titleEl) titleEl.innerHTML = '<i class="ri-copper-coin-fill" style="color: var(--brand-accent);"></i> <span>Target Celengan Impian Baru</span>';
    if (idInput) idInput.value = '';
    const dateInput = document.getElementById('savingsGoalTargetDate');
    if (dateInput) {
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      dateInput.value = sixMonthsLater.toISOString().slice(0, 10);
    }
  }

  openModal('modalSavingsGoal');
}

export function handleSaveSavingsGoal(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('savingsGoalId')?.value;
  const title = (document.getElementById('savingsGoalTitle')?.value || '').trim();
  const targetAmount = Number(document.getElementById('savingsGoalTargetAmount')?.value) || 0;
  const currentAmount = Number(document.getElementById('savingsGoalCurrentAmount')?.value) || 0;
  const category = document.getElementById('savingsGoalCategory')?.value || 'Lainnya';
  const targetDate = document.getElementById('savingsGoalTargetDate')?.value || '';
  const note = (document.getElementById('savingsGoalNote')?.value || '').trim();

  if (!title) {
    alert('Harap masukkan nama impian / target.');
    return;
  }
  if (targetAmount <= 0) {
    alert('Target nominal harus lebih dari 0.');
    return;
  }

  if (id) {
    const idx = (appState.savingsGoals || []).findIndex(g => g.id === id);
    if (idx !== -1) {
      appState.savingsGoals[idx] = {
        ...appState.savingsGoals[idx],
        title,
        targetAmount,
        currentAmount,
        category,
        targetDate,
        note,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    const newGoal = {
      id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title,
      targetAmount,
      currentAmount,
      category,
      targetDate,
      note,
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(appState.savingsGoals)) appState.savingsGoals = [];
    appState.savingsGoals.unshift(newGoal);
  }

  saveSavingsGoals();
  closeModal('modalSavingsGoal');
  renderSavingsGoals();
}

export function deleteSavingsGoal(goalId) {
  if (!goalId) return;
  const goal = (appState.savingsGoals || []).find(g => g.id === goalId);
  const goalName = goal ? goal.title : 'target ini';

  if (confirm(`Apakah Anda yakin ingin menghapus "${goalName}"? Tindakan ini tidak dapat dibatalkan.`)) {
    appState.savingsGoals = (appState.savingsGoals || []).filter(g => g.id !== goalId);
    saveSavingsGoals();
    renderSavingsGoals();
  }
}

export function openDepositGoalModal(goalId) {
  const goal = (appState.savingsGoals || []).find(g => g.id === goalId);
  if (!goal) return;

  const form = document.getElementById('formDepositGoal');
  if (form) form.reset();

  const elId = document.getElementById('depositGoalTargetId');
  const elName = document.getElementById('depositGoalTargetName');
  const elCur = document.getElementById('depositGoalCurrentVal');
  const elTgt = document.getElementById('depositGoalTargetVal');

  if (elId) elId.value = goal.id;
  if (elName) elName.textContent = goal.title;
  if (elCur) elCur.textContent = formatRupiah(goal.currentAmount || 0);
  if (elTgt) elTgt.textContent = formatRupiah(goal.targetAmount || 0);

  const btnAdd = document.getElementById('btnDepositGoalTypeAdd');
  const btnSub = document.getElementById('btnDepositGoalTypeSub');
  const typeInput = document.getElementById('depositGoalActionType');
  if (btnAdd && btnSub && typeInput) {
    btnAdd.classList.add('active', 'income');
    btnSub.classList.remove('active', 'income');
    typeInput.value = 'ADD';
  }

  openModal('modalDepositGoal');
}

export function handleSaveDepositGoal(e) {
  if (e) e.preventDefault();

  const goalId = document.getElementById('depositGoalTargetId')?.value;
  const actionType = document.getElementById('depositGoalActionType')?.value || 'ADD';
  const amount = Number(document.getElementById('depositGoalAmount')?.value) || 0;

  if (amount <= 0) {
    alert('Masukkan nominal setoran atau penarikan yang valid.');
    return;
  }

  const goal = (appState.savingsGoals || []).find(g => g.id === goalId);
  if (!goal) return;

  let current = Number(goal.currentAmount) || 0;
  if (actionType === 'SUB') {
    if (amount > current) {
      alert(`Jumlah penarikan (${formatRupiah(amount)}) melebihi saldo celengan (${formatRupiah(current)}).`);
      return;
    }
    goal.currentAmount = Math.max(0, current - amount);
  } else {
    goal.currentAmount = current + amount;
  }
  goal.updatedAt = new Date().toISOString();

  saveSavingsGoals();
  closeModal('modalDepositGoal');
  renderSavingsGoals();

  const verb = actionType === 'SUB' ? 'menarik' : 'menyetor';
  alert(`Berhasil ${verb} ${formatRupiah(amount)} pada target "${goal.title}"!`);
}
