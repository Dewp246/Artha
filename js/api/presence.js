/* ==========================================================================
   DewpBank - Realtime Online Presence & Channels
   ========================================================================== */

import { getSupabaseClient } from './supabase.js';
import { appState } from '../state.js';
import { STORAGE_KEYS, SUPER_ADMIN_EMAIL } from '../config.js';

let realtimeChannel = null;
let presenceChannel = null;
let presenceHeartbeatInterval = null;
export const onlinePresenceUsers = new Set();

export function recordKnownUser(email) {
  if (!email || !email.includes('@')) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.knownUsers);
    const list = raw ? JSON.parse(raw) : [];
    const set = new Set(list.map(e => e.toLowerCase()));
    set.add(SUPER_ADMIN_EMAIL);
    set.add('dewanggaarkaputra246@gmail.com');
    set.add(email.toLowerCase());
    localStorage.setItem(STORAGE_KEYS.knownUsers, JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Gagal menyimpan riwayat akun:', e);
  }
}

export function startPresenceHeartbeat() {
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval);
  }
  presenceHeartbeatInterval = setInterval(async () => {
    if (presenceChannel && appState.user?.email) {
      try {
        await presenceChannel.track({
          email: appState.user.email.toLowerCase(),
          device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'HP / Mobile' : 'Desktop / PC',
          online_at: new Date().toISOString()
        });
      } catch (e) {}
    }
  }, 15000);
}

export function initPresenceChannel() {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient || !appState.user?.email) return;

  const myEmail = appState.user.email.toLowerCase();
  onlinePresenceUsers.add(myEmail);

  if (presenceChannel) {
    try { supabaseClient.removeChannel(presenceChannel); } catch (e) {}
  }

  presenceChannel = supabaseClient.channel('artha-global-presence', {
    config: {
      presence: {
        key: myEmail
      }
    }
  });

  const extractPresenceUsers = () => {
    try {
      const state = presenceChannel.presenceState();
      onlinePresenceUsers.clear();
      if (appState.user?.email) {
        onlinePresenceUsers.add(appState.user.email.toLowerCase());
      }
      Object.keys(state).forEach(k => {
        if (k) onlinePresenceUsers.add(k.toLowerCase());
      });
      Object.values(state).forEach(presences => {
        if (Array.isArray(presences)) {
          presences.forEach(p => {
            if (p && p.email) {
              onlinePresenceUsers.add(p.email.toLowerCase());
            }
          });
        }
      });
      updateAdminPresenceUI();
    } catch (err) {
      console.warn('Presence sync error:', err);
    }
  };

  presenceChannel
    .on('presence', { event: 'sync' }, extractPresenceUsers)
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key) onlinePresenceUsers.add(key.toLowerCase());
      if (Array.isArray(newPresences)) {
        newPresences.forEach(p => {
          if (p && p.email) onlinePresenceUsers.add(p.email.toLowerCase());
        });
      }
      updateAdminPresenceUI();
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (key && key.toLowerCase() !== appState.user?.email?.toLowerCase()) {
        onlinePresenceUsers.delete(key.toLowerCase());
      }
      if (Array.isArray(leftPresences)) {
        leftPresences.forEach(p => {
          if (p && p.email && p.email.toLowerCase() !== appState.user?.email?.toLowerCase()) {
            onlinePresenceUsers.delete(p.email.toLowerCase());
          }
        });
      }
      updateAdminPresenceUI();
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await presenceChannel.track({
            email: myEmail,
            device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'HP / Mobile' : 'Desktop / PC',
            online_at: new Date().toISOString()
          });
          startPresenceHeartbeat();
        } catch (err) {
          console.warn('Presence track error:', err);
        }
      }
    });
}

export function updateAdminPresenceUI() {
  const elOnlineUsers = document.getElementById('adminOnlineUsers');
  if (elOnlineUsers) {
    const onlineCount = Math.max(1, onlinePresenceUsers.size);
    elOnlineUsers.textContent = `${onlineCount} Online`;
  }

  document.querySelectorAll('.admin-user-card').forEach(card => {
    const emailEl = card.querySelector('.admin-user-email');
    if (!emailEl) return;
    const cardEmail = emailEl.textContent.trim().toLowerCase();
    const isOnline = onlinePresenceUsers.has(cardEmail) || (appState.user?.email?.toLowerCase() === cardEmail);

    const badgeStatus = card.querySelector('.badge-presence-status');
    if (badgeStatus) {
      if (isOnline) {
        badgeStatus.style.background = 'rgba(16, 185, 129, 0.12)';
        badgeStatus.style.color = 'var(--income-green)';
        badgeStatus.style.borderColor = 'rgba(16, 185, 129, 0.25)';
        badgeStatus.innerHTML = `
          <span class="status-dot-sm" style="display: inline-block; width: 7px; height: 7px; background: var(--income-green); border-radius: 50%; margin-right: 4px;"></span>
          Aktif (Online)
        `;
      } else {
        badgeStatus.style.background = 'rgba(59, 130, 246, 0.12)';
        badgeStatus.style.color = '#3b82f6';
        badgeStatus.style.borderColor = 'rgba(59, 130, 246, 0.25)';
        badgeStatus.innerHTML = `
          <span class="status-dot-sm" style="display: inline-block; width: 7px; height: 7px; background: #3b82f6; border-radius: 50%; margin-right: 4px;"></span>
          Aktif (Cloud)
        `;
      }
    }
  });
}

export function subscribeToSupabaseRealtime(onSyncTrigger) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient || !appState.user?.id) return;

  if (realtimeChannel) {
    try { supabaseClient.removeChannel(realtimeChannel); } catch (e) {}
  }

  const userId = appState.user.id;
  realtimeChannel = supabaseClient
    .channel(`user-sync-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
      () => {
        if (typeof onSyncTrigger === 'function') onSyncTrigger();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${userId}` },
      () => {
        if (typeof onSyncTrigger === 'function') onSyncTrigger();
      }
    )
    .subscribe();

  initPresenceChannel();
}

export async function stopPresenceChannel() {
  const supabaseClient = getSupabaseClient();
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = null;
  }
  if (presenceChannel && supabaseClient) {
    try {
      await presenceChannel.untrack();
      supabaseClient.removeChannel(presenceChannel);
      presenceChannel = null;
    } catch (e) {}
  }
  onlinePresenceUsers.clear();
}
