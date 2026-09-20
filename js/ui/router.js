/* ==========================================================================
   DewpBank - Router & Navigation Module
   SPA Router, Desktop Sidebar Toggle, Responsif & Network Status
   ========================================================================== */

import { appState } from '../state.js';
import { getSupabaseClient } from '../api/supabase.js';
import { fetchFromSupabase } from '../api/sync.js';
import { getCashFlowChartInstance, getExpenseDonutChartInstance } from '../modules/charts.js';
import { renderTransactionsTable } from '../modules/transactions.js';
import { renderSavingsGoals } from '../modules/savings.js';
import { renderDebts } from '../modules/debts.js';
import { renderAdminData } from '../modules/admin.js';

let appRenderer = null;
export function setRouterAppRenderer(fn) {
  appRenderer = fn;
}

function triggerRenderApp() {
  if (typeof appRenderer === 'function') {
    appRenderer();
  } else if (typeof window.renderApp === 'function') {
    window.renderApp();
  }
}

export function switchView(viewName) {
  const vDash = document.getElementById('viewDashboard');
  const vTx = document.getElementById('viewTransactions');
  const vSavings = document.getElementById('viewSavings');
  const vDebts = document.getElementById('viewDebts');
  const vAdmin = document.getElementById('viewAdmin');
  const welcomeTitle = document.getElementById('welcomeTitle');

  const views = [
    { name: 'viewDashboard', el: vDash, page: 'dashboard', title: 'Ringkasan Keuangan' },
    { name: 'viewTransactions', el: vTx, page: 'transactions', title: 'Riwayat Transaksi' },
    { name: 'viewSavings', el: vSavings, page: 'savings', title: 'Celengan Impian & Wishlist' },
    { name: 'viewDebts', el: vDebts, page: 'debts', title: 'Catatan Hutang & Piutang' },
    { name: 'viewAdmin', el: vAdmin, page: 'admin', title: 'Pusat Kontrol Admin' }
  ];

  views.forEach(v => {
    if (v.el) {
      if (v.name === viewName) {
        v.el.style.display = 'block';
        v.el.classList.add('active');
      } else {
        v.el.style.display = 'none';
        v.el.classList.remove('active');
      }
    }
    document.querySelectorAll(`[data-page="${v.page}"]`).forEach(el => {
      if (v.name === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  });

  const activeViewObj = views.find(v => v.name === viewName);
  if (activeViewObj && welcomeTitle) {
    welcomeTitle.textContent = activeViewObj.title;
  }

  if (viewName === 'viewDashboard') {
    triggerRenderApp();
    setTimeout(() => {
      const c1 = getCashFlowChartInstance();
      const c2 = getExpenseDonutChartInstance();
      if (c1) c1.resize();
      if (c2) c2.resize();
    }, 100);
  } else if (viewName === 'viewTransactions') {
    renderTransactionsTable();
  } else if (viewName === 'viewSavings') {
    renderSavingsGoals();
  } else if (viewName === 'viewDebts') {
    renderDebts();
  } else if (viewName === 'viewAdmin') {
    renderAdminData();
  }
}

export function updateSidebarToggleButton(isCollapsed) {
  const btn = document.getElementById('btnToggleSidebarDesktop');
  if (btn) {
    btn.innerHTML = isCollapsed ? '<i class="ri-side-bar-line" style="transform: scaleX(-1); display: inline-block;"></i>' : '<i class="ri-side-bar-line"></i>';
    btn.title = isCollapsed ? 'Besarkan Sidebar' : 'Kecilkan Sidebar';
  }
}

export function initSidebarToggle() {
  const isCollapsed = localStorage.getItem('dewpbank_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    document.body.classList.add('sidebar-collapsed');
  }
  updateSidebarToggleButton(isCollapsed);
}

export function toggleSidebarDesktop() {
  const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('dewpbank_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  updateSidebarToggleButton(isCollapsed);

  setTimeout(() => {
    const c1 = getCashFlowChartInstance();
    const c2 = getExpenseDonutChartInstance();
    if (c1) c1.resize();
    if (c2) c2.resize();
  }, 350);
}

export function initWindowResizeHandler() {
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const c1 = getCashFlowChartInstance();
      const c2 = getExpenseDonutChartInstance();
      if (c1) c1.resize();
      if (c2) c2.resize();
    }, 100);
  });
}

export function showNetworkBanner(isOnline) {
  let banner = document.getElementById('networkStatusBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'networkStatusBanner';
    banner.style.cssText = `
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      padding: 0.6rem 1.15rem;
      border-radius: var(--radius-full);
      font-size: 0.8rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: var(--shadow-modal);
      transition: all 0.3s ease;
      pointer-events: none;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;
    document.body.appendChild(banner);
  }

  if (isOnline) {
    banner.style.opacity = '1';
    banner.style.background = 'var(--surface-card)';
    banner.style.color = 'var(--income-green)';
    banner.style.border = '1px solid var(--income-green-border)';
    banner.innerHTML = '<i class="ri-wifi-line"></i> <span>Koneksi internet pulih. Tersambung kembali ke cloud.</span>';
    setTimeout(() => {
      if (banner) banner.style.opacity = '0';
    }, 3500);
  } else {
    banner.style.opacity = '1';
    banner.style.background = 'var(--surface-card)';
    banner.style.color = 'var(--warning-amber)';
    banner.style.border = '1px solid var(--warning-amber-border)';
    banner.innerHTML = '<i class="ri-wifi-off-line"></i> <span>Koneksi internet terputus. Mode offline aktif (data tersimpan di perangkat).</span>';
  }
}

export function initNetworkStatusListener() {
  window.addEventListener('online', () => {
    showNetworkBanner(true);
    const client = getSupabaseClient();
    if (client && appState.user) {
      fetchFromSupabase();
    }
  });

  window.addEventListener('offline', () => {
    showNetworkBanner(false);
  });
}
