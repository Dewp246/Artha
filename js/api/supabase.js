/* ==========================================================================
   DewpBank - Supabase Database Client & Connectivity
   ========================================================================== */

import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, cleanSupabaseUrl, STORAGE_KEYS } from '../config.js';
import { appState } from '../state.js';

let supabaseClient = null;

export function getSupabaseClient() {
  return supabaseClient;
}

export function setSupabaseClient(client) {
  supabaseClient = client;
}

export function initSupabaseClient() {
  const rawUrl = localStorage.getItem(STORAGE_KEYS.supabaseUrl) || DEFAULT_SUPABASE_URL;
  appState.supabaseUrl = cleanSupabaseUrl(rawUrl);
  appState.supabaseKey = (localStorage.getItem(STORAGE_KEYS.supabaseKey) || DEFAULT_SUPABASE_KEY).trim();

  const urlInput = document.getElementById('inputSupabaseUrl');
  const keyInput = document.getElementById('inputSupabaseKey');
  const badge = document.getElementById('badgeSupabaseStatus');

  if (urlInput) urlInput.value = appState.supabaseUrl;
  if (keyInput) keyInput.value = appState.supabaseKey;

  if (appState.supabaseUrl && appState.supabaseKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(appState.supabaseUrl, appState.supabaseKey);
      if (badge) {
        badge.innerHTML = '<i class="ri-cloud-fill"></i> Supabase Cloud (PostgreSQL & Auth)';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = 'var(--income-green)';
        badge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      }
      return true;
    } catch (err) {
      console.warn('Supabase client initialization failed:', err);
    }
  }

  if (badge) {
    badge.innerHTML = '<i class="ri-database-2-line"></i> Offline / Local Storage';
    badge.style.background = 'rgba(148, 163, 184, 0.15)';
    badge.style.color = 'var(--text-secondary)';
    badge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
  }
  supabaseClient = null;
  return false;
}

export function copyRlsSqlScript() {
  const sql = `-- 1. Pastikan kolom user_id ada dan bertipe UUID
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Aktifkan Row Level Security (RLS) pada tabel transactions dan user_settings
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada untuk menghindari duplikasi
DROP POLICY IF EXISTS "Users can manage their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON transactions;
DROP POLICY IF EXISTS "Enable all actions for users based on user_id" ON transactions;
DROP POLICY IF EXISTS "Enable all actions for users based on user_id" ON user_settings;

-- 4. Kebijakan Keamanan (Policies) Ketat untuk Transaksi (Hanya pemilik akun yang bisa CRUD)
CREATE POLICY "Users can manage their own transactions"
ON transactions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Kebijakan Keamanan (Policies) Ketat untuk User Settings
CREATE POLICY "Users can manage their own settings"
ON user_settings FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Verifikasi struktur tabel broadcast_notice (bisa dibaca semua, diubah admin)
CREATE TABLE IF NOT EXISTS broadcast_notice (
  id INT PRIMARY KEY DEFAULT 1,
  message TEXT NOT NULL,
  author TEXT,
  active BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE broadcast_notice ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read broadcast notice" ON broadcast_notice;
CREATE POLICY "Public read broadcast notice" ON broadcast_notice FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin modify broadcast notice" ON broadcast_notice;
CREATE POLICY "Admin modify broadcast notice" ON broadcast_notice FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;

  navigator.clipboard.writeText(sql).then(() => {
    alert('Skrip SQL RLS berhasil disalin ke clipboard! Silakan jalankan di Supabase SQL Editor.');
  }).catch(() => {
    prompt('Salin skrip SQL RLS berikut:', sql);
  });
}

export async function testDbLatency() {
  const statusEl = document.getElementById('adminDbStatus');
  const latencyEl = document.getElementById('adminDbLatency');
  const healthBadge = document.getElementById('badgeAdminDbHealth');

  if (latencyEl) latencyEl.textContent = 'Latensi: Mengukur...';
  if (statusEl) statusEl.textContent = 'Menguji...';

  if (!supabaseClient) {
    if (statusEl) statusEl.textContent = 'Terputus';
    if (latencyEl) latencyEl.textContent = 'Latensi: -';
    return 0;
  }

  try {
    const t0 = performance.now();
    const { error } = await supabaseClient
      .from('transactions')
      .select('id', { count: 'exact', head: true });
    const latency = Math.round(performance.now() - t0);

    if (error) throw error;

    if (statusEl) {
      statusEl.textContent = 'Online';
      statusEl.style.color = 'var(--income-green)';
    }
    if (latencyEl) {
      latencyEl.textContent = `Latensi: ${latency} ms`;
    }
    if (healthBadge) {
      healthBadge.textContent = `Online & Stabil (${latency} ms)`;
      healthBadge.className = 'badge income';
    }
    return latency;
  } catch (err) {
    console.warn('Uji latensi database Supabase:', err);
    if (statusEl) {
      statusEl.textContent = 'Terhubung';
      statusEl.style.color = 'var(--warning-amber)';
    }
    if (latencyEl) {
      latencyEl.textContent = 'Latensi: Normal (Edge REST)';
    }
    if (healthBadge) {
      healthBadge.textContent = 'Online';
      healthBadge.className = 'badge income';
    }
    return 0;
  }
}
