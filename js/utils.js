/* ==========================================================================
   DewpBank - Utility Helpers & Formatters
   ========================================================================== */

import { CATEGORIES } from './config.js';

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getCategoryObj(catId) {
  const allCats = [...CATEGORIES.EXPENSE, ...CATEGORIES.INCOME];
  return allCats.find(c => c.id === catId) || { name: catId || 'Lainnya', icon: 'ri-price-tag-3-line', color: '#64748b' };
}

export function setupDateDisplay() {
  const dateElem = document.getElementById('currentDateDisplay');
  if (dateElem) {
    const today = new Date();
    dateElem.textContent = today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('appToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'appToastContainer';
    container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    pointer-events: auto;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #ffffff;
    background: ${type === 'danger' ? '#ef4444' : type === 'success' ? '#10b981' : '#0284c7'};
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(10px);
  `;
  const icon = type === 'danger' ? 'ri-error-warning-line' : type === 'success' ? 'ri-checkbox-circle-line' : 'ri-information-line';
  toast.innerHTML = `<i class="${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
