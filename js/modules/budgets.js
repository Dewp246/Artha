/* ==========================================================================
   DewpBank - Budget Management, Overspending Alerts & Health Score
   ========================================================================== */

import { appState, saveBudgetsLocal } from '../state.js';
import { CATEGORIES } from '../config.js';
import { pushToSupabase } from '../api/sync.js';
import { formatRupiah, getCategoryObj, escapeHtml } from '../utils.js';

export function renderBudgetProgress() {
  const container = document.getElementById('budgetProgressContainer');
  if (!container) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const categorySpent = {};
  (appState.transactions || []).forEach(tx => {
    if (!tx || !tx.date) return;
    const txDate = new Date(tx.date);
    if (tx.type === 'EXPENSE' && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
      categorySpent[tx.category] = (categorySpent[tx.category] || 0) + Number(tx.amount || 0);
    }
  });

  let html = '';
  CATEGORIES.EXPENSE.forEach(cat => {
    const spent = categorySpent[cat.id] || 0;
    const limit = (appState.budgets && appState.budgets[cat.id]) ? Number(appState.budgets[cat.id]) : 0;
    const percentage = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;

    let fillClass = '';
    if (percentage >= 90) fillClass = 'danger';
    else if (percentage >= 70) fillClass = 'warning';

    html += `
      <div class="budget-item">
        <div class="budget-meta">
          <span class="budget-name">
            <span class="category-icon-sm" style="background: ${cat.color}18; color: ${cat.color};">
              <i class="${cat.icon}"></i>
            </span>
            ${cat.name}
          </span>
          <div class="budget-values">
            <span>${formatRupiah(spent)}</span>
            <span class="budget-delimiter">/</span>
            <span class="limit">${formatRupiah(limit)}</span>
            <span class="budget-badge ${fillClass}">${percentage}%</span>
          </div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${fillClass}" style="width: ${percentage}%;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

export function openBudgetModal() {
  const container = document.getElementById('budgetInputsContainer');
  if (!container) return;

  let html = '';
  CATEGORIES.EXPENSE.forEach(cat => {
    const currentLimit = (appState.budgets && appState.budgets[cat.id]) ? Number(appState.budgets[cat.id]) : 0;
    html += `
      <div>
        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
          <i class="${cat.icon}" style="color: ${cat.color};"></i> ${cat.name}
        </label>
        <input type="number" class="glass-input budget-input-item" data-cat="${cat.id}" value="${currentLimit}" min="0" placeholder="0">
      </div>
    `;
  });

  container.innerHTML = html;
  const modal = document.getElementById('modalBudget');
  if (modal) modal.classList.add('active');
}

export function handleSaveBudgets(e, onRender) {
  if (e) e.preventDefault();

  document.querySelectorAll('.budget-input-item').forEach(input => {
    const catId = input.getAttribute('data-cat');
    const val = Number(input.value) || 0;
    if (!appState.budgets) appState.budgets = {};
    appState.budgets[catId] = val;
  });

  saveBudgetsLocal();
  pushToSupabase();

  const modal = document.getElementById('modalBudget');
  if (modal) modal.classList.remove('active');

  renderBudgetProgress();
  if (typeof onRender === 'function') onRender();
}

export function calculateFinancialHealth() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let incomeMonth = 0;
  let expenseMonth = 0;
  let needsExpense = 0;
  let wantsExpense = 0;

  const needsCategories = new Set(['cat_food', 'cat_transport', 'cat_bills', 'cat_health', 'cat_education']);

  (appState.transactions || []).forEach(tx => {
    if (!tx || !tx.date) return;
    const d = new Date(tx.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'INCOME') {
        incomeMonth += amt;
      } else if (tx.type === 'EXPENSE') {
        expenseMonth += amt;
        if (needsCategories.has(tx.category)) {
          needsExpense += amt;
        } else {
          wantsExpense += amt;
        }
      }
    }
  });

  const netSavings = Math.max(0, incomeMonth - expenseMonth);
  const totalBase = incomeMonth > 0 ? incomeMonth : (expenseMonth > 0 ? expenseMonth : 1);

  const needsRatio = Math.round((needsExpense / totalBase) * 100);
  const wantsRatio = Math.round((wantsExpense / totalBase) * 100);
  const savingsRatio = incomeMonth > 0 ? Math.round((netSavings / incomeMonth) * 100) : 0;

  let score = 50;

  if (incomeMonth > 0) {
    if (savingsRatio >= 20) score += 35;
    else if (savingsRatio >= 10) score += 20;
    else if (savingsRatio > 0) score += 10;
    else score -= 20;

    if (needsRatio <= 50) score += 10;
    else if (needsRatio > 70) score -= 15;

    if (wantsRatio <= 30) score += 10;
    else if (wantsRatio > 40) score -= 15;
  } else if (expenseMonth === 0) {
    score = 80;
  } else {
    score = 30;
  }

  let overbudgetCount = 0;
  Object.keys(appState.budgets || {}).forEach(catId => {
    const limit = Number(appState.budgets[catId]) || 0;
    if (limit > 0) {
      let spent = 0;
      (appState.transactions || []).forEach(tx => {
        if (!tx || !tx.date) return;
        const d = new Date(tx.date);
        if (tx.type === 'EXPENSE' && tx.category === catId && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          spent += Number(tx.amount) || 0;
        }
      });
      if (spent > limit) overbudgetCount++;
    }
  });
  score -= (overbudgetCount * 5);
  score = Math.max(10, Math.min(100, score));

  let statusLabel = 'Kondisi Sehat';
  let statusColor = 'var(--income-green)';
  if (score >= 85) {
    statusLabel = 'Sangat Sehat';
    statusColor = 'var(--income-green)';
  } else if (score >= 70) {
    statusLabel = 'Kondisi Baik';
    statusColor = 'var(--brand-accent)';
  } else if (score >= 50) {
    statusLabel = 'Perlu Waspada';
    statusColor = 'var(--warning-amber)';
  } else {
    statusLabel = 'Defisit / Kritis';
    statusColor = 'var(--expense-red)';
  }

  let tipText = '';
  if (incomeMonth === 0 && expenseMonth > 0) {
    tipText = 'Catat pemasukan bulanan Anda untuk menghitung rasio tabungan dan batas pengeluaran yang ideal.';
  } else if (overbudgetCount > 0) {
    tipText = `Terdapat ${overbudgetCount} pos belanja yang melebihi batas anggaran bulan ini. Prioritaskan pengendalian belanja pada kategori tersebut.`;
  } else if (wantsRatio > 35) {
    tipText = `Pengeluaran gaya hidup (${wantsRatio}%) melebihi anjuran ideal 30%. Anda bisa mengalihkan surplus ke Celengan Impian.`;
  } else if (savingsRatio >= 20) {
    tipText = `Luar biasa! Rasio tabungan Anda mencapai ${savingsRatio}%. Pertahankan disiplin ini dan percepat pencapaian impian Anda.`;
  } else if (savingsRatio < 10) {
    tipText = `Rasio tabungan Anda saat ini (${savingsRatio}%) masih di bawah anjuran 20%. Evaluasi pos pengeluaran sekunder untuk memperbesar dana cadangan.`;
  } else {
    tipText = 'Alokasi keuangan Anda berjalan seimbang. Terus pantau pengeluaran harian agar tetap sesuai rencana.';
  }

  return {
    score,
    statusLabel,
    statusColor,
    needsRatio: Math.min(100, needsRatio),
    wantsRatio: Math.min(100, wantsRatio),
    savingsRatio: Math.min(100, savingsRatio),
    tipText
  };
}

export function renderFinancialHealth() {
  const health = calculateFinancialHealth();

  const valScore = document.getElementById('valHealthScore');
  const lblStatus = document.getElementById('lblHealthStatus');
  const valNeeds = document.getElementById('valNeedsRatio');
  const barNeeds = document.getElementById('barNeedsFill');
  const valWants = document.getElementById('valWantsRatio');
  const barWants = document.getElementById('barWantsFill');
  const valSavings = document.getElementById('valSavingsRatio');
  const barSavings = document.getElementById('barSavingsFill');
  const tipTextEl = document.getElementById('healthSmartTipText');

  if (valScore) {
    valScore.textContent = health.score;
    valScore.style.color = health.statusColor;
  }
  if (lblStatus) {
    lblStatus.textContent = health.statusLabel;
    lblStatus.style.color = health.statusColor;
  }
  if (valNeeds) valNeeds.textContent = `${health.needsRatio}%`;
  if (barNeeds) barNeeds.style.width = `${Math.min(100, health.needsRatio)}%`;

  if (valWants) valWants.textContent = `${health.wantsRatio}%`;
  if (barWants) barWants.style.width = `${Math.min(100, health.wantsRatio)}%`;

  if (valSavings) valSavings.textContent = `${health.savingsRatio}%`;
  if (barSavings) barSavings.style.width = `${Math.min(100, health.savingsRatio)}%`;

  if (tipTextEl) tipTextEl.textContent = health.tipText;
}

export function renderOverspendingAlerts() {
  const banner = document.getElementById('overspendingAlertBanner');
  if (!banner) return;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const spentPerCategory = {};
  (appState.transactions || []).forEach(tx => {
    if (!tx || !tx.date) return;
    const d = new Date(tx.date);
    if (tx.type === 'EXPENSE' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      spentPerCategory[tx.category] = (spentPerCategory[tx.category] || 0) + (Number(tx.amount) || 0);
    }
  });

  const overList = [];
  Object.keys(appState.budgets || {}).forEach(catId => {
    const limit = Number(appState.budgets[catId]) || 0;
    if (limit > 0) {
      const spent = spentPerCategory[catId] || 0;
      const pct = Math.round((spent / limit) * 100);
      if (pct >= 80) {
        const catObj = getCategoryObj(catId);
        overList.push({
          catId,
          name: catObj.name,
          spent,
          limit,
          pct,
          isDanger: pct >= 100
        });
      }
    }
  });

  if (overList.length === 0) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  overList.sort((a, b) => b.pct - a.pct);

  const hasDanger = overList.some(item => item.isDanger);
  const cardClass = hasDanger ? 'overspending-alert-card' : 'overspending-alert-card warning';
  const iconClass = hasDanger ? 'ri-error-warning-fill' : 'ri-alert-line';
  const titleText = hasDanger
    ? 'Peringatan: Anggaran Bulanan Terlampaui'
    : 'Perhatian: Pengeluaran Mendekati Batas Anggaran';
  const descText = hasDanger
    ? 'Terdapat kategori belanja yang telah melampaui 100% dari batas anggaran yang Anda tentukan:'
    : 'Kategori belanja berikut telah mencapai lebih dari 80% dari batas anggaran bulanan:';

  const chipsHtml = overList.map(item => `
    <span class="overspending-chip ${item.isDanger ? 'danger' : 'warning'}">
      <span>${escapeHtml(item.name)}:</span>
      <strong>${item.pct}%</strong>
      <span style="font-weight: 400; opacity: 0.85;">(${formatRupiah(item.spent)} / ${formatRupiah(item.limit)})</span>
    </span>
  `).join('');

  banner.style.display = 'block';
  banner.innerHTML = `
    <div class="${cardClass}">
      <div class="overspending-alert-icon">
        <i class="${iconClass}"></i>
      </div>
      <div class="overspending-alert-content">
        <div class="overspending-alert-title">${titleText}</div>
        <div class="overspending-alert-desc">${descText}</div>
        <div class="overspending-chips-wrap">
          ${chipsHtml}
        </div>
      </div>
    </div>
  `;
}
