/* ==========================================================================
   DewpBank / Artha - Main Application Entry Point
   Orkestrator Utama ES Module, Event Listeners, & Inisialisasi Sistem
   ========================================================================== */

import { SUPER_ADMIN_EMAIL } from './config.js';
import {
  appState,
  initAppState,
  setCloudPusher,
  saveTransactions,
  saveBudgets,
  saveMomBalance,
  saveSavingsGoals,
  saveDebts
} from './state.js';
import {
  setupDateDisplay,
  formatRupiah,
  formatDate,
  getCategoryObj,
  escapeHtml
} from './utils.js';
import {
  initSupabaseClient,
  copyRlsSqlScript,
  testDbLatency,
  getSupabaseClient
} from './api/supabase.js';
import {
  startPresenceHeartbeat,
  initPresenceChannel,
  updateAdminPresenceUI,
  onlinePresenceUsers
} from './api/presence.js';
import {
  fetchFromSupabase,
  pushToSupabase,
  deleteFromSupabase,
  subscribeToSupabaseRealtime
} from './api/sync.js';
import {
  initSupabaseAuth,
  handleScreenLogin,
  handleScreenRegister,
  showForgotPasswordScreen,
  showResetPasswordScreen,
  showLoginScreenTab,
  handleForgotPassword,
  handleResetPassword,
  handleLogoutUser,
  showAuthScreenAlert
} from './api/auth.js';
import {
  renderDashboardRecentTx,
  renderMetrics,
  renderPaymentChannels,
  renderTransactionsTable,
  populateCategorySelects,
  openAddTxModal,
  handleSaveTransaction,
  editTransaction,
  deleteTransaction,
  setAppRenderer as setTxAppRenderer
} from './modules/transactions.js';
import {
  renderBudgetProgress,
  openBudgetModal,
  handleSaveBudgets,
  calculateFinancialHealth,
  renderFinancialHealth,
  renderOverspendingAlerts
} from './modules/budgets.js';
import {
  openMomModal,
  handleWithdrawMom,
  handleDepositMom,
  handleSetMomBalance
} from './modules/momBalance.js';
import {
  renderSavingsGoals,
  openAddSavingsGoalModal,
  handleSaveSavingsGoal,
  deleteSavingsGoal,
  openDepositGoalModal,
  handleSaveDepositGoal
} from './modules/savings.js';
import {
  renderDebts,
  openAddDebtModal,
  handleSaveDebt,
  toggleDebtPaidStatus,
  deleteDebt
} from './modules/debts.js';

import {
  renderCharts,
  renderCashFlowChart,
  renderExpenseDonutChart
} from './modules/charts.js';
import {
  switchAdminTab,
  copyAdminRpcSqlScript,
  adminCopyUserEmail,
  adminSendUserPasswordReset,
  adminViewUserDetails,
  adminConfirmDeleteUser,
  handleExecuteAdminDeleteUser,
  renderAdminData,
  handleAdminTestEmail,
  updateBroadcastBannerUI,
  handleSaveAdminBroadcast
} from './modules/admin.js';
import {
  initTheme,
  applyTheme,
  toggleTheme
} from './ui/theme.js';
import {
  openModal,
  closeModal,
  exportDataJSON,
  exportDataCSV,
  importDataJSON,
  clearAllData,
  setModalsAppRenderer
} from './ui/modals.js';
import {
  switchView,
  initSidebarToggle,
  toggleSidebarDesktop,
  initWindowResizeHandler,
  initNetworkStatusListener,
  setRouterAppRenderer
} from './ui/router.js';

// ==========================================
// Central Render Orchestrator
// ==========================================
export function renderApp() {
  renderMetrics();
  renderBudgetProgress();
  renderPaymentChannels();
  renderDashboardRecentTx();
  renderTransactionsTable();
  renderCharts();
  renderFinancialHealth();
  renderOverspendingAlerts();
  renderSavingsGoals();
  renderDebts();
  updateBroadcastBannerUI();
}

// Connect app renderer to other modules
setTxAppRenderer(renderApp);
setModalsAppRenderer(renderApp);
setRouterAppRenderer(renderApp);
setCloudPusher(pushToSupabase);

// ==========================================
// PWA Registration & Install Prompt
// ==========================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('SW Registration failed: ', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.deferredPwaPrompt = e;
    const banner = document.getElementById('pwaBanner');
    if (banner) banner.style.display = 'flex';
  });

  document.getElementById('btnInstallPwa')?.addEventListener('click', () => {
    if (appState.deferredPwaPrompt) {
      appState.deferredPwaPrompt.prompt();
      appState.deferredPwaPrompt.userChoice.then(() => {
        appState.deferredPwaPrompt = null;
        const banner = document.getElementById('pwaBanner');
        if (banner) banner.style.display = 'none';
      });
    }
  });
}

// ==========================================
// Global Event Listeners Setup
// ==========================================
function setupEventListeners() {
  // Navigation links & SPA Router
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');

      if (page === 'dashboard') {
        switchView('viewDashboard');
      } else if (page === 'transactions') {
        switchView('viewTransactions');
      } else if (page === 'savings') {
        switchView('viewSavings');
      } else if (page === 'debts') {
        switchView('viewDebts');
      } else if (page === 'settings') {
        openModal('modalSettings');
      } else if (page === 'budget') {
        openBudgetModal();
      } else if (page === 'admin') {
        switchView('viewAdmin');
      }
    });
  });

  // Admin Operational Handlers
  document.getElementById('btnTestDbLatency')?.addEventListener('click', testDbLatency);
  document.getElementById('btnRefreshAdminUsers')?.addEventListener('click', renderAdminData);
  document.getElementById('btnCopyAdminRpcSql')?.addEventListener('click', copyAdminRpcSqlScript);
  document.getElementById('btnCloseAdminUserDetails')?.addEventListener('click', () => closeModal('modalAdminUserDetails'));
  document.getElementById('btnCancelAdminDeleteUser')?.addEventListener('click', () => closeModal('modalAdminDeleteUser'));
  document.getElementById('btnConfirmAdminDeleteUser')?.addEventListener('click', handleExecuteAdminDeleteUser);
  document.getElementById('btnAdminTestEmail')?.addEventListener('click', handleAdminTestEmail);
  document.getElementById('btnAdminExportMaster')?.addEventListener('click', exportDataJSON);
  document.getElementById('tabAdminOverview')?.addEventListener('click', () => switchAdminTab('overview'));
  document.getElementById('tabAdminUsers')?.addEventListener('click', () => switchAdminTab('users'));
  document.getElementById('cardAdminOnlineUsers')?.addEventListener('click', () => switchAdminTab('users'));

  // Theme, Sync & Sidebar Toggle Buttons
  document.getElementById('btnToggleTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnToggleSidebarDesktop')?.addEventListener('click', toggleSidebarDesktop);
  document.getElementById('btnSeeAllTxDashboard')?.addEventListener('click', () => switchView('viewTransactions'));

  document.getElementById('btnHeaderSync')?.addEventListener('click', async () => {
    const icon = document.getElementById('iconHeaderSync');
    if (icon) icon.classList.add('ri-spin');
    await pushToSupabase();
    await fetchFromSupabase();
    setTimeout(() => {
      if (icon) icon.classList.remove('ri-spin');
    }, 600);
  });

  // Transaction segmented type filter buttons
  document.querySelectorAll('#txTypeFilterSegmented .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#txTypeFilterSegmented .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const select = document.getElementById('filterTypeSelect');
      if (select) {
        select.value = btn.dataset.type;
      }
      renderTransactionsTable();
    });
  });

  // Modal open buttons
  document.getElementById('btnOpenAddTxModal')?.addEventListener('click', () => openAddTxModal());
  document.getElementById('fabAddTx')?.addEventListener('click', () => openAddTxModal());
  document.getElementById('btnOpenBudgetModal')?.addEventListener('click', () => openBudgetModal());
  document.getElementById('btnOpenMomModal')?.addEventListener('click', () => openMomModal());
  document.getElementById('btnOpenAddSavingsGoalModal')?.addEventListener('click', () => openAddSavingsGoalModal());
  document.getElementById('btnOpenAddDebtModal')?.addEventListener('click', () => openAddDebtModal());

  // Modal close buttons
  document.getElementById('btnCloseTxModal')?.addEventListener('click', () => closeModal('modalTransaction'));
  document.getElementById('btnCancelTx')?.addEventListener('click', () => closeModal('modalTransaction'));
  document.getElementById('btnCloseBudgetModal')?.addEventListener('click', () => closeModal('modalBudget'));
  document.getElementById('btnCancelBudget')?.addEventListener('click', () => closeModal('modalBudget'));
  document.getElementById('btnCloseSettingsModal')?.addEventListener('click', () => closeModal('modalSettings'));
  document.getElementById('btnCloseMomModal')?.addEventListener('click', () => closeModal('modalMomMoney'));
  document.getElementById('btnCloseAuthModal')?.addEventListener('click', () => closeModal('modalAuth'));
  document.getElementById('btnCancelDeleteTx')?.addEventListener('click', () => closeModal('modalConfirmDelete'));
  document.getElementById('btnCloseSavingsGoalModal')?.addEventListener('click', () => closeModal('modalSavingsGoal'));
  document.getElementById('btnCancelSavingsGoal')?.addEventListener('click', () => closeModal('modalSavingsGoal'));
  document.getElementById('btnCloseDepositGoalModal')?.addEventListener('click', () => closeModal('modalDepositGoal'));
  document.getElementById('btnCancelDepositGoal')?.addEventListener('click', () => closeModal('modalDepositGoal'));
  document.getElementById('btnCloseDebtModal')?.addEventListener('click', () => closeModal('modalDebt'));
  document.getElementById('btnCancelDebt')?.addEventListener('click', () => closeModal('modalDebt'));

  // Auth Screen Tab Switchers & Form Actions
  const tabScreenLogin = document.getElementById('tabScreenLogin');
  const tabScreenRegister = document.getElementById('tabScreenRegister');
  const formScreenLogin = document.getElementById('formScreenLogin');
  const formScreenRegister = document.getElementById('formScreenRegister');

  tabScreenLogin?.addEventListener('click', () => {
    tabScreenLogin.classList.add('active');
    tabScreenRegister?.classList.remove('active');
    if (formScreenLogin) formScreenLogin.style.display = 'block';
    if (formScreenRegister) formScreenRegister.style.display = 'none';
    showAuthScreenAlert('', 'none');
  });

  tabScreenRegister?.addEventListener('click', () => {
    tabScreenRegister.classList.add('active');
    tabScreenLogin?.classList.remove('active');
    if (formScreenRegister) formScreenRegister.style.display = 'block';
    if (formScreenLogin) formScreenLogin.style.display = 'none';
    showAuthScreenAlert('', 'none');
  });

  // Password Visibility Toggles
  const setupPassToggle = (btnId, inputId, iconId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!btn || !input || !icon) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      icon.className = isPass ? 'ri-eye-off-line' : 'ri-eye-line';
    });
  };

  setupPassToggle('btnToggleLoginPass', 'screenLoginPassword', 'iconToggleLoginPass');
  setupPassToggle('btnToggleRegisterPass', 'screenRegisterPassword', 'iconToggleRegisterPass');
  setupPassToggle('btnToggleNewPass', 'screenNewPassword', 'iconToggleNewPass');
  setupPassToggle('btnToggleConfirmPass', 'screenConfirmNewPassword', 'iconToggleConfirmPass');

  // Forgot & Reset Password Events
  document.getElementById('btnOpenForgotPassword')?.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordScreen();
  });

  document.getElementById('btnBackToLoginFromForgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginScreenTab();
  });

  document.getElementById('formScreenForgotPassword')?.addEventListener('submit', handleForgotPassword);
  document.getElementById('formScreenResetPassword')?.addEventListener('submit', handleResetPassword);

  // Keyboard Shortcuts (UX Enhancement)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
    if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      switchView('viewTransactions');
      setTimeout(() => document.getElementById('searchTxInput')?.focus(), 50);
    }
  });

  formScreenLogin?.addEventListener('submit', (e) => handleScreenLogin(e, renderApp));
  formScreenRegister?.addEventListener('submit', (e) => handleScreenRegister(e, renderApp));
  document.getElementById('btnSubmitScreenLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleScreenLogin(e, renderApp);
  });
  document.getElementById('btnSubmitScreenRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    handleScreenRegister(e, renderApp);
  });

  // Settings Actions
  document.getElementById('btnSyncSettings')?.addEventListener('click', async () => {
    const client = getSupabaseClient();
    if (client) {
      await pushToSupabase();
      await fetchFromSupabase();
      alert('Sinkronisasi data berhasil!');
    }
  });

  document.getElementById('btnLogoutSettings')?.addEventListener('click', handleLogoutUser);

  // Confirm Delete Transaction Action
  document.getElementById('btnConfirmDeleteTx')?.addEventListener('click', async () => {
    const id = document.getElementById('deleteTxIdTarget')?.value;
    if (id) {
      appState.transactions = (appState.transactions || []).filter(t => t.id !== id);
      saveTransactions();
      closeModal('modalConfirmDelete');
      renderApp();
      await deleteFromSupabase(id);
    }
  });

  // Uang di Orang Tua Actions
  document.getElementById('btnWithdrawMom')?.addEventListener('click', handleWithdrawMom);
  document.getElementById('btnDepositMom')?.addEventListener('click', handleDepositMom);
  document.getElementById('btnSetMomBalance')?.addEventListener('click', handleSetMomBalance);

  // Toggle Expense / Income in Transaction Modal
  const btnExpense = document.getElementById('btnToggleExpense');
  const btnIncome = document.getElementById('btnToggleIncome');
  const txTypeInput = document.getElementById('txType');

  btnExpense?.addEventListener('click', () => {
    btnExpense.classList.add('active', 'expense');
    btnIncome.classList.remove('active', 'income');
    if (txTypeInput) txTypeInput.value = 'EXPENSE';
    populateCategorySelects();
  });

  btnIncome?.addEventListener('click', () => {
    btnIncome.classList.add('active', 'income');
    btnExpense.classList.remove('active', 'expense');
    if (txTypeInput) txTypeInput.value = 'INCOME';
    populateCategorySelects();
  });

  // Submit Forms
  document.getElementById('formTransaction')?.addEventListener('submit', handleSaveTransaction);
  document.getElementById('formBudget')?.addEventListener('submit', handleSaveBudgets);
  document.getElementById('formSavingsGoal')?.addEventListener('submit', handleSaveSavingsGoal);
  document.getElementById('formDepositGoal')?.addEventListener('submit', handleSaveDepositGoal);

  // Toggle Deposit / Withdraw Action in Deposit Modal
  const btnDepositAdd = document.getElementById('btnDepositGoalTypeAdd');
  const btnDepositSub = document.getElementById('btnDepositGoalTypeSub');
  const depositActionType = document.getElementById('depositGoalActionType');
  btnDepositAdd?.addEventListener('click', () => {
    btnDepositAdd.classList.add('active', 'income');
    btnDepositSub.classList.remove('active', 'income');
    if (depositActionType) depositActionType.value = 'ADD';
  });
  btnDepositSub?.addEventListener('click', () => {
    btnDepositSub.classList.add('active', 'income');
    btnDepositAdd.classList.remove('active', 'income');
    if (depositActionType) depositActionType.value = 'SUB';
  });

  // Savings Filter Segmented Buttons
  document.querySelectorAll('#savingsFilterSegmented .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#savingsFilterSegmented .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.savingsFilter = btn.dataset.filter || 'ALL';
      renderSavingsGoals();
    });
  });

  // Submit Debt Form
  document.getElementById('formDebt')?.addEventListener('submit', handleSaveDebt);

  // Toggle Debt Type (Hutang Saya vs Piutang Saya)
  const btnDebtDebt = document.getElementById('btnDebtTypeDebt');
  const btnDebtLoan = document.getElementById('btnDebtTypeLoan');
  const debtTypeVal = document.getElementById('debtTypeVal');
  btnDebtDebt?.addEventListener('click', () => {
    btnDebtDebt.classList.add('active', 'expense');
    btnDebtLoan.classList.remove('active', 'income');
    if (debtTypeVal) debtTypeVal.value = 'DEBT';
  });
  btnDebtLoan?.addEventListener('click', () => {
    btnDebtLoan.classList.add('active', 'income');
    btnDebtDebt.classList.remove('active', 'expense');
    if (debtTypeVal) debtTypeVal.value = 'LOAN';
  });

  // Debt Filter Segmented Buttons
  document.querySelectorAll('#debtTypeFilterSegmented .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#debtTypeFilterSegmented .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appState.debtsFilter = btn.dataset.filter || 'ALL';
      renderDebts();
    });
  });

  // Search & Filter Events
  document.getElementById('searchTxInput')?.addEventListener('input', renderTransactionsTable);
  document.getElementById('filterTypeSelect')?.addEventListener('change', renderTransactionsTable);
  document.getElementById('filterCategorySelect')?.addEventListener('change', renderTransactionsTable);
  document.getElementById('filterPaymentSelect')?.addEventListener('change', renderTransactionsTable);
  document.getElementById('txFilterDateStart')?.addEventListener('change', renderTransactionsTable);
  document.getElementById('txFilterDateEnd')?.addEventListener('change', renderTransactionsTable);
  document.getElementById('btnApplyDateFilter')?.addEventListener('click', renderTransactionsTable);
  document.getElementById('selectChartYear')?.addEventListener('change', renderCashFlowChart);

  // Transaction Date Preset Chips
  document.querySelectorAll('#datePresetChips .preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#datePresetChips .preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      appState.txDatePreset = chip.dataset.preset || 'ALL';
      const customRow = document.getElementById('customDateRangeRow');
      if (customRow) {
        customRow.style.display = appState.txDatePreset === 'CUSTOM' ? 'flex' : 'none';
      }
      renderTransactionsTable();
    });
  });

  // Reset Transaction Filter Button
  document.getElementById('btnResetTxFilter')?.addEventListener('click', () => {
    const search = document.getElementById('searchTxInput');
    const cat = document.getElementById('filterCategorySelect');
    const pay = document.getElementById('filterPaymentSelect');
    const startDate = document.getElementById('txFilterDateStart');
    const endDate = document.getElementById('txFilterDateEnd');
    if (search) search.value = '';
    if (cat) cat.value = 'ALL';
    if (pay) pay.value = 'ALL';
    if (startDate) startDate.value = '';
    if (endDate) endDate.value = '';

    document.querySelectorAll('#txTypeFilterSegmented .seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === 'ALL');
    });
    const typeSelect = document.getElementById('filterTypeSelect');
    if (typeSelect) typeSelect.value = 'ALL';

    document.querySelectorAll('#datePresetChips .preset-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === 'ALL');
    });
    appState.txDatePreset = 'ALL';
    const customRow = document.getElementById('customDateRangeRow');
    if (customRow) customRow.style.display = 'none';

    renderTransactionsTable();
  });

  // Global Broadcast Banner & Admin Broadcast Handlers
  document.getElementById('btnCloseBroadcastBanner')?.addEventListener('click', () => {
    const banner = document.getElementById('globalBroadcastBanner');
    if (banner) banner.style.display = 'none';
    if (appState.broadcastNotice) {
      sessionStorage.setItem('artha_broadcast_dismissed_' + (appState.broadcastNotice.updatedAt || '0'), 'true');
    }
  });
  document.getElementById('btnSaveAdminBroadcast')?.addEventListener('click', handleSaveAdminBroadcast);

  // Backup & Restore Actions
  document.getElementById('btnExportJSON')?.addEventListener('click', exportDataJSON);
  document.getElementById('btnExportCSV')?.addEventListener('click', exportDataCSV);
  document.getElementById('btnTriggerImport')?.addEventListener('click', () => document.getElementById('inputImportJSON')?.click());
  document.getElementById('inputImportJSON')?.addEventListener('change', importDataJSON);
  document.getElementById('btnClearAllData')?.addEventListener('click', clearAllData);

  // Auto-sync when user returns to app
  window.addEventListener('focus', () => {
    const client = getSupabaseClient();
    if (client && appState.user) {
      fetchFromSupabase();
    }
  });

  document.addEventListener('visibilitychange', () => {
    const client = getSupabaseClient();
    if (!document.hidden && client && appState.user) {
      fetchFromSupabase();
    }
  });
}

// ==========================================
// Window Globals for HTML Inline Handlers
// ==========================================
window.renderApp = renderApp;
window.openModal = openModal;
window.closeModal = closeModal;

window.openAddTxModal = openAddTxModal;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.openBudgetModal = openBudgetModal;
window.openMomModal = openMomModal;
window.openAddSavingsGoalModal = openAddSavingsGoalModal;
window.openDepositGoalModal = openDepositGoalModal;
window.deleteSavingsGoal = deleteSavingsGoal;
window.openAddDebtModal = openAddDebtModal;
window.toggleDebtPaidStatus = toggleDebtPaidStatus;
window.deleteDebt = deleteDebt;
window.adminViewUserDetails = adminViewUserDetails;
window.adminConfirmDeleteUser = adminConfirmDeleteUser;
window.adminSendUserPasswordReset = adminSendUserPasswordReset;
window.adminCopyUserEmail = adminCopyUserEmail;
window.switchAdminTab = switchAdminTab;
window.copyAdminRpcSqlScript = copyAdminRpcSqlScript;
window.renderAdminData = renderAdminData;
window.testDbLatency = testDbLatency;
window.appState = appState;

// ==========================================
// Application Bootstrap (DOMContentLoaded)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebarToggle();
  initWindowResizeHandler();
  initNetworkStatusListener();
  initAppState();
  populateCategorySelects();
  initSupabaseClient();
  initSupabaseAuth(renderApp);
  setupEventListeners();
  setupDateDisplay();
  registerServiceWorker();
  renderApp();
});
