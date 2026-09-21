/* ==========================================================================
   DewpBank - Cloud Sync Engine (PostgreSQL & Local Storage)
   ========================================================================== */

import { getSupabaseClient, initSupabaseClient } from './supabase.js';
import { appState, getDeletedIds, addDeletedId, resetAppStateData } from '../state.js';
import { STORAGE_KEYS, DEFAULT_BUDGETS, cleanSupabaseUrl } from '../config.js';
export { subscribeToSupabaseRealtime } from './presence.js';

export async function pushTransactionsArray(txList, userId) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient || !txList || txList.length === 0 || !userId) return;
  try {
    const withUser = txList.map(t => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      category: t.category,
      payment: t.payment || 'Tunai / Cash',
      date: t.date,
      note: t.note || '',
      user_id: userId
    }));
    const { error } = await supabaseClient.from('transactions').upsert(withUser, { onConflict: 'id' });
    if (error) console.warn('Push transaksi gagal:', error);
  } catch (e) {
    console.warn('pushTransactionsArray error:', e);
  }
}

export async function fetchFromSupabase(onRender) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return;

  try {
    let userId = appState.user ? appState.user.id : null;
    if (!userId) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData?.session?.user) {
        appState.user = sessionData.session.user;
        userId = sessionData.session.user.id;
      }
    }

    if (!userId) {
      resetAppStateData();
      if (typeof onRender === 'function') onRender();
      return;
    }

    // 1. Ambil transaksi KHUSUS milik user ini
    const res = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!res.error && Array.isArray(res.data)) {
      const deletedIds = getDeletedIds();

      // Hapus data dummy dan data yang sudah dihapus jika masih ada di Supabase
      const toDeleteFromRemote = res.data
        .filter(item => deletedIds.has(item.id) || item.id?.startsWith('tx_demo_') || item.note?.includes('Uang Jajan Bulanan dari Orang Tua'))
        .map(item => item.id);

      if (toDeleteFromRemote.length > 0) {
        await supabaseClient.from('transactions').delete().in('id', toDeleteFromRemote).eq('user_id', userId);
      }

      const validRemoteList = res.data.filter(
        item => !deletedIds.has(item.id) && !item.id?.startsWith('tx_demo_') && !item.note?.includes('Uang Jajan Bulanan dari Orang Tua')
      );

      // Deduplikasi cerdas berdasarkan tipe, jumlah, catatan, dan tanggal
      const seenKeys = new Set();
      const dedupedTransactions = [];
      const duplicateIdsToDelete = [];

      validRemoteList.forEach(item => {
        const normNote = (item.note || '').trim().toLowerCase();
        const key = `${item.type}_${Number(item.amount)}_${normNote}_${item.date ? item.date.slice(0, 10) : ''}`;

        if (seenKeys.has(key) && item.id?.startsWith('tx_real_')) {
          duplicateIdsToDelete.push(item.id);
        } else if (!seenKeys.has(key)) {
          seenKeys.add(key);
          dedupedTransactions.push({
            id: item.id,
            type: item.type,
            amount: Number(item.amount),
            category: item.category,
            payment: item.payment || 'Tunai / Cash',
            date: item.date,
            note: item.note || ''
          });
        }
      });

      if (duplicateIdsToDelete.length > 0) {
        await supabaseClient.from('transactions').delete().in('id', duplicateIdsToDelete).eq('user_id', userId);
      }

      appState.transactions = dedupedTransactions;
      appState.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      localStorage.setItem(STORAGE_KEYS.transactions(userId), JSON.stringify(appState.transactions));
    }

    // 2. Ambil pengaturan anggaran & saldo di orang tua KHUSUS user ini
    const settingsRes = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!settingsRes.error && settingsRes.data) {
      if (settingsRes.data.budgets && typeof settingsRes.data.budgets === 'object') {
        appState.budgets = { ...DEFAULT_BUDGETS, ...settingsRes.data.budgets };
        localStorage.setItem(STORAGE_KEYS.budgets(userId), JSON.stringify(appState.budgets));
      } else {
        appState.budgets = { ...DEFAULT_BUDGETS };
      }
      if (settingsRes.data.mom_balance !== undefined && settingsRes.data.mom_balance !== null) {
        appState.momBalance = Number(settingsRes.data.mom_balance);
        localStorage.setItem(STORAGE_KEYS.momBalance(userId), appState.momBalance.toString());
      }
      if (settingsRes.data.savings_goals && Array.isArray(settingsRes.data.savings_goals)) {
        appState.savingsGoals = settingsRes.data.savings_goals;
        localStorage.setItem(STORAGE_KEYS.savingsGoals(userId), JSON.stringify(appState.savingsGoals));
      }
      if (settingsRes.data.debts && Array.isArray(settingsRes.data.debts)) {
        appState.debts = settingsRes.data.debts;
        localStorage.setItem(STORAGE_KEYS.debts(userId), JSON.stringify(appState.debts));
      }
      if (settingsRes.data.broadcast_notice) {
        appState.broadcastNotice = settingsRes.data.broadcast_notice;
        localStorage.setItem(STORAGE_KEYS.broadcastNotice, JSON.stringify(appState.broadcastNotice));
      }
    } else if (!settingsRes.error && !settingsRes.data) {
      // Akun baru belum memiliki record: inisialisasi default dan simpan
      appState.budgets = { ...DEFAULT_BUDGETS };
      appState.momBalance = 0;
      appState.savingsGoals = [];
      appState.debts = [];
      localStorage.setItem(STORAGE_KEYS.budgets(userId), JSON.stringify(appState.budgets));
      localStorage.setItem(STORAGE_KEYS.momBalance(userId), '0');
      localStorage.setItem(STORAGE_KEYS.savingsGoals(userId), '[]');
      localStorage.setItem(STORAGE_KEYS.debts(userId), '[]');

      await supabaseClient.from('user_settings').upsert({
        id: userId,
        user_id: userId,
        budgets: appState.budgets,
        mom_balance: 0,
        savings_goals: [],
        debts: [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    if (typeof onRender === 'function') onRender();
  } catch (err) {
    console.warn('Supabase sync error:', err);
  }
}

export async function pushToSupabase() {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return;

  try {
    let userId = appState.user ? appState.user.id : null;
    if (!userId) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      if (sessionData?.session?.user) {
        appState.user = sessionData.session.user;
        userId = sessionData.session.user.id;
      }
    }

    if (!userId) return;

    const deletedIds = getDeletedIds();
    const cleanTx = (appState.transactions || []).filter(
      t => !deletedIds.has(t.id) && !t.id?.startsWith('tx_demo_') && !t.note?.includes('Uang Jajan Bulanan dari Orang Tua')
    );

    if (cleanTx.length > 0) {
      await pushTransactionsArray(cleanTx, userId);
    }

    const settingsObj = {
      id: userId,
      user_id: userId,
      budgets: appState.budgets,
      mom_balance: appState.momBalance,
      savings_goals: appState.savingsGoals || [],
      debts: appState.debts || [],
      broadcast_notice: appState.broadcastNotice || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('user_settings').upsert(settingsObj, { onConflict: 'id' });
    if (error) console.warn('Supabase push user_settings error:', error);

  } catch (err) {
    console.warn('Supabase push error:', err);
  }
}

export async function deleteFromSupabase(id) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient || !id || !appState.user?.id) return;
  try {
    addDeletedId(id);
    const { error } = await supabaseClient
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', appState.user.id);
    if (error) console.warn('Supabase delete error:', error);
  } catch (err) {
    console.warn('Supabase delete error:', err);
  }
}

export async function handleSaveSupabaseConfig(onRender) {
  const rawUrl = (document.getElementById('inputSupabaseUrl')?.value || '').trim();
  const key = (document.getElementById('inputSupabaseKey')?.value || '').trim();

  const url = cleanSupabaseUrl(rawUrl);

  if (!url || !key) {
    alert('Harap isi Supabase Project URL dan Anon Key.');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.supabaseUrl, url);
  localStorage.setItem(STORAGE_KEYS.supabaseKey, key);

  if (initSupabaseClient()) {
    await pushToSupabase();
    await fetchFromSupabase(onRender);
    subscribeToSupabaseRealtime(() => fetchFromSupabase(onRender));
    alert('Berhasil terhubung ke Supabase Cloud Database (PostgreSQL)! Data kamu kini otomatis ter-sync secara Realtime.');
  } else {
    alert('Gagal menghubungkan ke Supabase. Periksa kembali Project URL dan Anon Key.');
  }
}
