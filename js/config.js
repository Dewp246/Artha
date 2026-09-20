/* ==========================================================================
   DewpBank - Application Configuration & Constants
   ========================================================================== */

export const SUPER_ADMIN_EMAIL = 'dewanggaputra246@gmail.com';

export const DEFAULT_SUPABASE_URL = 'https://oehvgsnzkfheuleobouo.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_Oi-ehxcLkTBfCWvMq2WwXg_Nl_lzBfj';

export function cleanSupabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  return rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export const CATEGORIES = {
  EXPENSE: [
    { id: 'cat_food', name: 'Makanan & Minuman', icon: 'ri-restaurant-line', color: '#06b6d4' },
    { id: 'cat_transport', name: 'Transportasi', icon: 'ri-car-line', color: '#3b82f6' },
    { id: 'cat_shopping', name: 'Belanja', icon: 'ri-shopping-bag-3-line', color: '#ec4899' },
    { id: 'cat_bills', name: 'Tagihan & Utilitas', icon: 'ri-flashlight-line', color: '#eab308' },
    { id: 'cat_entertainment', name: 'Hiburan & Hobi', icon: 'ri-gamepad-line', color: '#a855f7' },
    { id: 'cat_health', name: 'Kesehatan', icon: 'ri-heart-pulse-line', color: '#ef4444' },
    { id: 'cat_education', name: 'Pendidikan', icon: 'ri-book-read-line', color: '#10b981' },
    { id: 'cat_other_exp', name: 'Lainnya (Pengeluaran)', icon: 'ri-price-tag-3-line', color: '#64748b' }
  ],
  INCOME: [
    { id: 'cat_salary', name: 'Gaji Utama', icon: 'ri-briefcase-line', color: '#10b981' },
    { id: 'cat_freelance', name: 'Bonus / Freelance', icon: 'ri-computer-line', color: '#14b8a6' },
    { id: 'cat_investment', name: 'Investasi', icon: 'ri-funds-box-line', color: '#06b6d4' },
    { id: 'cat_gift', name: 'Hadiah / Hibah', icon: 'ri-gift-line', color: '#f43f5e' },
    { id: 'cat_other_inc', name: 'Lainnya (Pemasukan)', icon: 'ri-wallet-line', color: '#64748b' }
  ]
};

export const DEFAULT_BUDGETS = {
  cat_food: 500000,
  cat_transport: 250000,
  cat_entertainment: 200000,
  cat_shopping: 150000,
  cat_education: 50000,
  cat_bills: 0,
  cat_health: 0,
  cat_other_exp: 0
};

export const STORAGE_KEYS = {
  transactions: (userId) => `dewpbank_transactions_${userId}`,
  budgets: (userId) => `dewpbank_budgets_${userId}`,
  momBalance: (userId) => `dewpbank_mom_balance_${userId}`,
  savingsGoals: (userId) => `dewpbank_savings_goals_${userId}`,
  debts: (userId) => `dewpbank_debts_${userId}`,
  broadcastNotice: 'dewpbank_broadcast_notice',
  deletedIds: (userId) => `dewpbank_deleted_ids_${userId}`,
  supabaseUrl: 'dewpbank_supabase_url',
  supabaseKey: 'dewpbank_supabase_key',
  theme: 'dewpbank_theme',
  sidebarDesktop: 'dewpbank_sidebar_desktop_open',
  knownUsers: 'dewpbank_known_users_v2'
};
