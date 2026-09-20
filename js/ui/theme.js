/* ==========================================================================
   DewpBank - Theme Module
   Manajemen Tema Antarmuka (Light / Dark Mode, Sinkronisasi Chart.js)
   ========================================================================== */

import { renderCharts, getCashFlowChartInstance, getExpenseDonutChartInstance } from '../modules/charts.js';

export function initTheme() {
  const savedTheme = localStorage.getItem('dewpbank_theme') || 'light';
  applyTheme(savedTheme);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dewpbank_theme', theme);

  const textElem = document.getElementById('themeToggleText');
  const iconSun = document.querySelector('.icon-sun');
  const iconMoon = document.querySelector('.icon-moon');

  if (theme === 'dark') {
    if (textElem) textElem.textContent = 'Dark Mode';
    if (iconSun) iconSun.style.display = 'inline-block';
    if (iconMoon) iconMoon.style.display = 'none';
  } else {
    if (textElem) textElem.textContent = 'Light Mode';
    if (iconSun) iconSun.style.display = 'none';
    if (iconMoon) iconMoon.style.display = 'inline-block';
  }

  if (getCashFlowChartInstance() || getExpenseDonutChartInstance()) {
    renderCharts();
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}
