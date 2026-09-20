/* ==========================================================================
   DewpBank - Global State Store & Persistence Layer
   ========================================================================== */

import { DEFAULT_BUDGETS, STORAGE_KEYS } from './config.js';

export const appState = {
  transactions: [],
  budgets: { ...DEFAULT_BUDGETS },
  momBalance: 0,
  savingsGoals: [],
  debts: [],
  broadcastNotice: {
    message: '',
    author: '',
    active: false,
    updatedAt: ''
  },
  savingsFilter: 'ALL',
  debtsFilter: 'ALL',
  txDatePreset: 'ALL',
  supabaseUrl: '',
  supabaseKey: '',
  deferredPwaPrompt: null,
  user: null
};

// Chart.js instances
export const chartState = {
  cashFlow: null,
  expenseDonut: null
};

export function resetAppStateData() {
  appState.transactions = [];
  appState.budgets = { ...DEFAULT_BUDGETS };
  appState.momBalance = 0;
  appState.savingsGoals = [];
  appState.debts = [];
}

export function loadUserLocalData(userId) {
  if (!userId) {
    resetAppStateData();
    return;
  }

  const txKey = STORAGE_KEYS.transactions(userId);
  const budgetKey = STORAGE_KEYS.budgets(userId);
  const momKey = STORAGE_KEYS.momBalance(userId);
  const savingsKey = STORAGE_KEYS.savingsGoals(userId);
  const debtsKey = STORAGE_KEYS.debts(userId);
  const broadcastKey = STORAGE_KEYS.broadcastNotice;

  const savedTx = localStorage.getItem(txKey);
  const savedBudgets = localStorage.getItem(budgetKey);
  const savedMom = localStorage.getItem(momKey);
  const savedSavings = localStorage.getItem(savingsKey);
  const savedDebts = localStorage.getItem(debtsKey);
  const savedBroadcast = localStorage.getItem(broadcastKey);

  if (savedTx) {
    try {
      const parsed = JSON.parse(savedTx);
      appState.transactions = Array.isArray(parsed)
        ? parsed.filter(t => !t.id?.startsWith('tx_demo_') && !t.note?.includes('Uang Jajan Bulanan dari Orang Tua'))
        : [];
    } catch (e) {
      appState.transactions = [];
    }
  } else {
    appState.transactions = [];
  }

  if (savedBudgets) {
    try {
      const parsedBudgets = JSON.parse(savedBudgets);
      appState.budgets = (parsedBudgets && typeof parsedBudgets === 'object')
        ? { ...DEFAULT_BUDGETS, ...parsedBudgets }
        : { ...DEFAULT_BUDGETS };
    } catch (e) {
      appState.budgets = { ...DEFAULT_BUDGETS };
    }
  } else {
    appState.budgets = { ...DEFAULT_BUDGETS };
  }

  if (savedMom !== null && savedMom !== undefined) {
    appState.momBalance = Number(savedMom) || 0;
  } else {
    appState.momBalance = 0;
  }

  if (savedSavings) {
    try {
      appState.savingsGoals = JSON.parse(savedSavings) || [];
    } catch (e) {
      appState.savingsGoals = [];
    }
  } else {
    appState.savingsGoals = [];
  }

  if (savedDebts) {
    try {
      appState.debts = JSON.parse(savedDebts) || [];
    } catch (e) {
      appState.debts = [];
    }
  } else {
    appState.debts = [];
  }

  if (savedBroadcast) {
    try {
      appState.broadcastNotice = JSON.parse(savedBroadcast);
    } catch (e) {}
  }
}

export function saveTransactionsLocal() {
  if (appState.user?.id) {
    localStorage.setItem(STORAGE_KEYS.transactions(appState.user.id), JSON.stringify(appState.transactions));
  }
}

export function saveBudgetsLocal() {
  if (appState.user?.id) {
    localStorage.setItem(STORAGE_KEYS.budgets(appState.user.id), JSON.stringify(appState.budgets));
  }
}

export function saveMomBalanceLocal() {
  if (appState.user?.id) {
    localStorage.setItem(STORAGE_KEYS.momBalance(appState.user.id), appState.momBalance.toString());
  }
}

export function saveSavingsGoalsLocal() {
  if (appState.user?.id) {
    localStorage.setItem(STORAGE_KEYS.savingsGoals(appState.user.id), JSON.stringify(appState.savingsGoals));
  }
}

export function saveDebtsLocal() {
  if (appState.user?.id) {
    localStorage.setItem(STORAGE_KEYS.debts(appState.user.id), JSON.stringify(appState.debts));
  }
}

export function saveBroadcastNoticeLocal() {
  localStorage.setItem(STORAGE_KEYS.broadcastNotice, JSON.stringify(appState.broadcastNotice));
}

let cloudPusher = null;
export function setCloudPusher(fn) {
  cloudPusher = fn;
}

export function saveTransactions() {
  saveTransactionsLocal();
  if (typeof cloudPusher === 'function') cloudPusher();
}

export function saveBudgets() {
  saveBudgetsLocal();
  if (typeof cloudPusher === 'function') cloudPusher();
}

export function saveMomBalance() {
  saveMomBalanceLocal();
  if (typeof cloudPusher === 'function') cloudPusher();
}

export function saveSavingsGoals() {
  saveSavingsGoalsLocal();
  if (typeof cloudPusher === 'function') cloudPusher();
}

export function saveDebts() {
  saveDebtsLocal();
  if (typeof cloudPusher === 'function') cloudPusher();
}

export function saveBroadcastNotice() {
  saveBroadcastNoticeLocal();
  if (appState.user?.id && appState.user.email?.toLowerCase() === 'dewanggaputra246@gmail.com') {
    if (typeof cloudPusher === 'function') cloudPusher();
  }
}

export function initAppState() {
  resetAppStateData();
}

export function getDeletedIds() {
  if (!appState.user?.id) return new Set();
  try {
    const raw = localStorage.getItem(`dewpbank_deleted_tx_ids_${appState.user.id}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (e) {
    return new Set();
  }
}

export function addDeletedId(id) {
  if (!id || !appState.user?.id) return;
  try {
    const set = getDeletedIds();
    set.add(id);
    localStorage.setItem(`dewpbank_deleted_tx_ids_${appState.user.id}`, JSON.stringify(Array.from(set)));
  } catch (e) {}
}

export function clearDeletedIds() {
  if (appState.user?.id) {
    localStorage.removeItem(`dewpbank_deleted_tx_ids_${appState.user.id}`);
  }
}
