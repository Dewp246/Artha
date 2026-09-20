/* ==========================================================================
   DewpBank - Chart.js Visualizations (Cash Flow & Expense Donut)
   ========================================================================== */

import { appState, chartState } from '../state.js';
import { CATEGORIES } from '../config.js';
import { formatRupiah } from '../utils.js';

export function renderCharts() {
  renderCashFlowChart();
  renderExpenseDonutChart();
}

export function renderCashFlowChart() {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx || !window.Chart) return;

  const selectedYear = parseInt(document.getElementById('selectChartYear')?.value || new Date().getFullYear());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

  const incomeData = new Array(12).fill(0);
  const expenseData = new Array(12).fill(0);

  (appState.transactions || []).forEach(tx => {
    if (!tx || !tx.date) return;
    const d = new Date(tx.date);
    if (d.getFullYear() === selectedYear) {
      const monthIdx = d.getMonth();
      if (tx.type === 'INCOME') {
        incomeData[monthIdx] += Number(tx.amount || 0);
      } else {
        expenseData[monthIdx] += Number(tx.amount || 0);
      }
    }
  });

  if (chartState.cashFlow) {
    chartState.cashFlow.destroy();
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const isDark = currentTheme === 'dark';
  const labelColor = isDark ? '#e2e8f0' : '#0f172a';
  const tickColor = isDark ? '#94a3b8' : '#334155';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  chartState.cashFlow = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          backgroundColor: 'rgba(244, 63, 94, 0.85)',
          borderColor: '#f43f5e',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: labelColor, font: { family: 'Outfit', weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatRupiah(context.raw)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { weight: '500' } },
          grid: { color: gridColor }
        },
        y: {
          ticks: {
            color: tickColor,
            font: { weight: '500' },
            callback: (value) => value >= 1000000 ? (value / 1000000) + 'Jt' : value
          },
          grid: { color: gridColor }
        }
      }
    }
  });
}

export function renderExpenseDonutChart() {
  const canvas = document.getElementById('expenseDonutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx || !window.Chart) return;

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const isDark = currentTheme === 'dark';
  const labelColor = isDark ? '#e2e8f0' : '#0f172a';
  const donutBorderColor = isDark ? '#080d1a' : '#ffffff';

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const categoryTotals = {};
  (appState.transactions || []).forEach(tx => {
    if (!tx || !tx.date) return;
    const d = new Date(tx.date);
    if (tx.type === 'EXPENSE' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + Number(tx.amount || 0);
    }
  });

  const labels = [];
  const data = [];
  const colors = [];

  CATEGORIES.EXPENSE.forEach(cat => {
    if (categoryTotals[cat.id] && categoryTotals[cat.id] > 0) {
      labels.push(cat.name);
      data.push(categoryTotals[cat.id]);
      colors.push(cat.color);
    }
  });

  if (chartState.expenseDonut) {
    chartState.expenseDonut.destroy();
  }

  if (data.length === 0) {
    chartState.expenseDonut = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Belum Ada Pengeluaran'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: labelColor } }
        }
      }
    });
    return;
  }

  chartState.expenseDonut = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: donutBorderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: labelColor, font: { family: 'Outfit', size: 11, weight: '600' }, padding: 12 }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatRupiah(context.raw)}`
          }
        }
      },
      cutout: '70%'
    }
  });
}

export function getCashFlowChartInstance() {
  return chartState.cashFlow;
}

export function getExpenseDonutChartInstance() {
  return chartState.expenseDonut;
}
