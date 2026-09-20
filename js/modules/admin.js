/* ==========================================================================
   DewpBank - Admin Control Panel Module
   Pusat Operasional Super Admin (RPC, Diagnostik, Manajemen Akun, Siaran)
   ========================================================================== */

import { SUPER_ADMIN_EMAIL } from '../config.js';
import { appState, saveBroadcastNotice } from '../state.js';
import { getSupabaseClient, testDbLatency } from '../api/supabase.js';
import { onlinePresenceUsers } from '../api/presence.js';
import { openModal, closeModal } from '../ui/modals.js';

export function switchAdminTab(tabName) {
  const tabOverview = document.getElementById('tabAdminOverview');
  const tabUsers = document.getElementById('tabAdminUsers');
  const panelOverview = document.getElementById('panelAdminOverview');
  const panelUsers = document.getElementById('panelAdminUsers');

  if (tabName === 'overview') {
    tabOverview?.classList.add('active');
    tabUsers?.classList.remove('active');
    if (panelOverview) panelOverview.style.display = 'block';
    if (panelUsers) panelUsers.style.display = 'none';
  } else if (tabName === 'users') {
    tabUsers?.classList.add('active');
    tabOverview?.classList.remove('active');
    if (panelOverview) panelOverview.style.display = 'none';
    if (panelUsers) panelUsers.style.display = 'block';
  }
}

export function copyAdminRpcSqlScript() {
  const sql = `-- =======================================================
-- Script RPC Admin Artha: Sinkronisasi & Manajemen Akun
-- Eksekusi script ini di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =======================================================

-- 1. Fungsi Ambil Seluruh Pengguna & Total Transaksi
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  total_tx BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validasi keamanan: Hanya email Super Admin yang diizinkan mengambil seluruh user
  IF auth.jwt() ->> 'email' = 'dewanggaputra246@gmail.com' THEN
    RETURN QUERY
    SELECT 
      u.id,
      u.email::TEXT,
      u.created_at,
      u.last_sign_in_at,
      COUNT(t.id) AS total_tx
    FROM auth.users u
    LEFT JOIN public.transactions t ON t.user_id = u.id
    GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at
    ORDER BY u.created_at DESC;
  ELSE
    RAISE EXCEPTION 'Akses ditolak: Hanya Super Admin yang diizinkan.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_users() TO authenticated;

-- 2. Fungsi Hapus Akun & Seluruh Data Terkait (Super Admin Only)
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID DEFAULT NULL, target_email TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resolved_id UUID := target_user_id;
BEGIN
  -- Validasi keamanan: Hanya email Super Admin yang diizinkan
  IF auth.jwt() ->> 'email' = 'dewanggaputra246@gmail.com' THEN
    -- Cari ID akun jika belum diberikan
    IF resolved_id IS NULL AND target_email IS NOT NULL THEN
      SELECT id INTO resolved_id FROM auth.users WHERE LOWER(email) = LOWER(target_email) LIMIT 1;
    END IF;

    IF resolved_id IS NULL THEN
      RAISE EXCEPTION 'Pengguna tidak ditemukan di database.';
    END IF;

    -- Cegah penghapusan Super Admin
    IF resolved_id = auth.uid() OR LOWER(target_email) = 'dewanggaputra246@gmail.com' THEN
      RAISE EXCEPTION 'Akses ditolak: Tidak dapat menghapus akun Super Admin utama.';
    END IF;

    -- Hapus data transaksi dan pengaturan pengguna
    DELETE FROM public.transactions WHERE user_id = resolved_id;
    DELETE FROM public.user_settings WHERE user_id = resolved_id;
    -- Hapus akun pengguna dari auth.users
    DELETE FROM auth.users WHERE id = resolved_id;

    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Akses ditolak: Hanya Super Admin yang diizinkan.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_user(UUID, TEXT) TO authenticated;
`;

  navigator.clipboard.writeText(sql).then(() => {
    alert('Script SQL Supabase berhasil disalin ke clipboard!\n\nScript ini mencakup:\n1. get_admin_users (Sinkronisasi seluruh pengguna)\n2. admin_delete_user (Izin hapus akun permanen bagi Super Admin)\n\nSilakan buka Supabase Dashboard -> SQL Editor, tempel (Paste) script ini lalu klik tombol "RUN".');
  }).catch(err => {
    console.warn('Gagal menyalin otomatis:', err);
    prompt('Salin script SQL Supabase berikut secara manual:', sql);
  });
}

export function adminCopyUserEmail(email) {
  if (!email) return;
  navigator.clipboard.writeText(email).then(() => {
    alert(`Email "${email}" berhasil disalin ke clipboard!`);
  }).catch(() => {
    prompt('Salin email pengguna:', email);
  });
}

export async function adminSendUserPasswordReset(email) {
  if (!email) return;
  const ok = confirm(`Kirimkan tautan reset kata sandi ke email "${email}"?`);
  if (!ok) return;

  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    alert(`Sukses: Tautan reset kata sandi telah dikirimkan ke email ${email}.`);
  } catch (err) {
    alert(`Gagal mengirimkan tautan reset kata sandi: ${err.message || err}`);
  }
}

export function adminViewUserDetails(encodedJson) {
  try {
    const u = JSON.parse(decodeURIComponent(encodedJson));
    const avatar = document.getElementById('modalUserDetailAvatar');
    const emailEl = document.getElementById('modalUserDetailEmail');
    const roleBadges = document.getElementById('modalUserDetailRoleBadges');
    const txEl = document.getElementById('modalUserDetailTx');
    const presenceEl = document.getElementById('modalUserDetailPresence');
    const idEl = document.getElementById('modalUserDetailId');
    const createdEl = document.getElementById('modalUserDetailCreatedAt');
    const lastSignInEl = document.getElementById('modalUserDetailLastSignIn');
    const btnCopy = document.getElementById('btnModalUserDetailCopy');
    const btnReset = document.getElementById('btnModalUserDetailResetPass');

    if (avatar) avatar.textContent = (u.email || 'U').charAt(0).toUpperCase();
    if (emailEl) emailEl.textContent = u.email || '-';

    const isSuper = (u.role || '').includes('Admin');
    const isOnline = (u.status || '').includes('Online');

    if (roleBadges) {
      roleBadges.innerHTML = `
        <span class="badge ${isSuper ? 'income' : 'neutral'}">${u.role || 'Pengguna'}</span>
        <span class="badge" style="background: ${isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)'}; color: ${isOnline ? 'var(--income-green)' : '#3b82f6'}; border: 1px solid ${isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'};">
          <span class="status-dot-sm" style="display: inline-block; width: 7px; height: 7px; background: ${isOnline ? 'var(--income-green)' : '#3b82f6'}; border-radius: 50%; margin-right: 4px;"></span>
          ${u.status || 'Aktif'}
        </span>
      `;
    }

    if (txEl) txEl.textContent = u.records || '0 Transaksi';
    if (presenceEl) {
      presenceEl.textContent = isOnline ? 'Online (Aktif)' : 'Offline / Tersimpan di Cloud';
      presenceEl.style.color = isOnline ? 'var(--income-green)' : 'var(--text-secondary)';
    }

    if (idEl) idEl.textContent = u.id || 'Terdata di Local Storage';
    if (createdEl) {
      createdEl.textContent = u.created_at ? new Date(u.created_at).toLocaleString('id-ID') : 'Tercatat di Sistem';
    }
    if (lastSignInEl) {
      lastSignInEl.textContent = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('id-ID') : (isOnline ? 'Sedang Aktif' : 'Belum Ada Riwayat Sesi');
    }

    if (btnCopy) {
      btnCopy.onclick = () => adminCopyUserEmail(u.email);
    }
    if (btnReset) {
      btnReset.onclick = () => adminSendUserPasswordReset(u.email);
    }

    openModal('modalAdminUserDetails');
  } catch (err) {
    console.warn('Gagal menampilkan detail user:', err);
  }
}

export function adminConfirmDeleteUser(userId, userEmail) {
  if (!userEmail || userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    alert('Akses ditolak: Akun Super Admin utama tidak dapat dihapus.');
    return;
  }

  const elId = document.getElementById('adminDeleteUserIdTarget');
  const elEmail = document.getElementById('adminDeleteUserEmailTarget');
  const elTargetText = document.getElementById('adminDeleteUserTargetEmail');

  if (elId) elId.value = userId || '';
  if (elEmail) elEmail.value = userEmail || '';
  if (elTargetText) elTargetText.textContent = userEmail || '';

  openModal('modalAdminDeleteUser');
}

export async function handleExecuteAdminDeleteUser() {
  const elId = document.getElementById('adminDeleteUserIdTarget');
  const elEmail = document.getElementById('adminDeleteUserEmailTarget');
  const btn = document.getElementById('btnConfirmAdminDeleteUser');

  const userId = elId?.value || null;
  const userEmail = elEmail?.value || '';

  if (!userEmail) {
    closeModal('modalAdminDeleteUser');
    return;
  }

  if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    alert('Akses ditolak: Akun Super Admin utama tidak dapat dihapus.');
    closeModal('modalAdminDeleteUser');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Menghapus...';
  }

  let rpcSuccess = false;
  const client = getSupabaseClient();

  // 1. Upayakan menghapus di Supabase database via RPC admin_delete_user
  try {
    if (client) {
      const { error } = await client.rpc('admin_delete_user', {
        target_user_id: userId || null,
        target_email: userEmail
      });

      if (!error) {
        rpcSuccess = true;
      } else {
        console.warn('RPC admin_delete_user error:', error);
      }
    }
  } catch (err) {
    console.warn('Eksekusi hapus admin error:', err);
  }

  // 2. Bersihkan dari artha_known_users di browser
  try {
    const raw = localStorage.getItem('artha_known_users');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter(e => String(e).toLowerCase() !== userEmail.toLowerCase());
        localStorage.setItem('artha_known_users', JSON.stringify(filtered));
      }
    }
  } catch (e) {
    console.warn('Gagal membersihkan artha_known_users:', e);
  }

  // 3. Bersihkan dari onlinePresenceUsers
  onlinePresenceUsers.delete(userEmail.toLowerCase());

  closeModal('modalAdminDeleteUser');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ri-delete-bin-line"></i> Ya, Hapus Akun';
  }

  if (rpcSuccess) {
    alert(`Sukses: Akun "${userEmail}" beserta seluruh data transaksinya telah berhasil dihapus permanen dari Supabase.`);
  } else {
    alert(`Akun "${userEmail}" telah dihapus dari daftar lokal.\n\nCatatan: Jika akun masih muncul dari database setelah refresh, pastikan Anda telah menjalankan Script SQL Supabase terbaru (klik tombol "Script SQL Supabase") di SQL Editor agar fungsi penghapusan permanen aktif di server Supabase.`);
  }

  await renderAdminData();
}

export async function renderAdminData() {
  // 1. Uji dan tampilkan latensi terkini
  await testDbLatency();

  const client = getSupabaseClient();

  // 2. Hitung total transaksi global di sistem
  let txCount = appState.transactions ? appState.transactions.length : 0;
  try {
    if (client) {
      const { count, error } = await client
        .from('transactions')
        .select('id', { count: 'exact', head: true });
      if (!error && typeof count === 'number') {
        txCount = count;
      }
    }
  } catch (err) {
    console.warn('Pengambilan total transaksi admin:', err);
  }

  const elTotalTx = document.getElementById('adminTotalTx');
  if (elTotalTx) {
    elTotalTx.textContent = Number(txCount).toLocaleString('id-ID');
  }

  // 3. Daftar akun terdaftar di ekosistem (RPC Supabase atau Fallback Cloud Terdata)
  let usersList = [];

  // Upayakan memanggil Supabase RPC get_admin_users
  try {
    if (client) {
      const { data: rpcUsers, error: rpcErr } = await client.rpc('get_admin_users');
      if (!rpcErr && Array.isArray(rpcUsers) && rpcUsers.length > 0) {
        usersList = rpcUsers.map(u => {
          const uEmail = (u.email || '').toLowerCase();
          const isSuper = uEmail === SUPER_ADMIN_EMAIL.toLowerCase();
          const isCurrent = appState.user?.email?.toLowerCase() === uEmail;
          const isOnline = isCurrent || onlinePresenceUsers.has(uEmail);

          return {
            id: u.id || '',
            email: u.email,
            role: isSuper ? 'Super Admin' : 'Pengguna',
            status: isOnline ? 'Aktif (Online)' : 'Aktif (Cloud)',
            records: `${u.total_tx || 0} Transaksi`,
            rawTxCount: u.total_tx || 0,
            created_at: u.created_at || null,
            last_sign_in_at: u.last_sign_in_at || null
          };
        });
      }
    }
  } catch (rpcEx) {
    console.warn('Supabase RPC get_admin_users belum aktif:', rpcEx);
  }

  // Fallback jika RPC Supabase belum dijalankan di SQL Editor
  if (usersList.length === 0) {
    let knownEmails = [
      SUPER_ADMIN_EMAIL,
      'dewanggaarkaputra246@gmail.com'
    ];

    try {
      const raw = localStorage.getItem('artha_known_users');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          knownEmails = Array.from(new Set([...knownEmails, ...parsed.map(e => String(e).toLowerCase())]));
        }
      }
    } catch (e) {
      console.warn('Gagal membaca riwayat akun lokal:', e);
    }

    if (appState.user?.email) {
      knownEmails.push(appState.user.email.toLowerCase());
    }

    const uniqueEmails = Array.from(new Set(knownEmails.filter(e => e && e.includes('@'))));

    usersList = uniqueEmails.map(em => {
      const isSuper = em.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const isCurrent = appState.user?.email?.toLowerCase() === em.toLowerCase();
      const isOnline = isCurrent || onlinePresenceUsers.has(em.toLowerCase());
      let recStr = 'Terdaftar di Cloud';
      let rawCount = 0;
      if (isSuper) {
        recStr = `${txCount} Transaksi`;
        rawCount = txCount;
      } else if (isCurrent && appState.transactions) {
        recStr = `${appState.transactions.length} Transaksi`;
        rawCount = appState.transactions.length;
      }

      return {
        id: '',
        email: em,
        role: isSuper ? 'Super Admin' : 'Pengguna',
        status: isOnline ? 'Aktif (Online)' : 'Aktif (Cloud)',
        records: recStr,
        rawTxCount: rawCount,
        created_at: null,
        last_sign_in_at: null
      };
    });
  }

  // 4. Update Status Pengguna Online Global
  const onlineCount = usersList.filter(u => u.status.includes('Online')).length;
  const elOnlineUsers = document.getElementById('adminOnlineUsers');
  if (elOnlineUsers) {
    elOnlineUsers.textContent = `${Math.max(1, onlineCount)} Online`;
  }

  const badgeTotalCount = document.getElementById('badgeTotalUsersCount');
  if (badgeTotalCount) {
    badgeTotalCount.textContent = usersList.length;
  }

  // 5. Render Daftar Pengguna sebagai List View
  const listContainer = document.getElementById('adminUsersListContainer');
  if (listContainer) {
    listContainer.innerHTML = usersList.map(u => {
      const initial = u.email.charAt(0).toUpperCase();
      const isSuper = u.role.includes('Admin');
      const isOnline = u.status.includes('Online');
      const uJson = encodeURIComponent(JSON.stringify(u));

      return `
        <div class="admin-user-card" data-user-email="${u.email}">
          <div class="admin-user-main">
            <div class="admin-user-avatar">${initial}</div>
            <div class="admin-user-details">
              <div class="admin-user-email">${u.email}</div>
              <div class="admin-user-badges">
                <span class="badge ${isSuper ? 'income' : 'neutral'}">${u.role}</span>
                <span class="badge badge-presence-status" style="background: ${isOnline ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)'}; color: ${isOnline ? 'var(--income-green)' : '#3b82f6'}; border: 1px solid ${isOnline ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'};">
                  <span class="status-dot-sm" style="display: inline-block; width: 7px; height: 7px; background: ${isOnline ? 'var(--income-green)' : '#3b82f6'}; border-radius: 50%; margin-right: 4px;"></span>
                  ${u.status}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-user-right">
            <div class="admin-user-stats">
              <div class="stat-label">Total Catatan Transaksi</div>
              <div class="stat-value">${u.records}</div>
            </div>
            <div class="admin-user-actions">
              <button type="button" class="btn-admin-action" onclick="adminViewUserDetails('${uJson}')" title="Lihat Rincian Akun">
                <i class="ri-information-line"></i>
              </button>
              <button type="button" class="btn-admin-action" onclick="adminCopyUserEmail('${u.email}')" title="Salin Email">
                <i class="ri-file-copy-line"></i>
              </button>
              <button type="button" class="btn-admin-action" onclick="adminSendUserPasswordReset('${u.email}')" title="Kirim Tautan Reset Sandi">
                <i class="ri-key-2-line"></i>
              </button>
              ${!isSuper ? `
              <button type="button" class="btn-admin-action danger" onclick="adminConfirmDeleteUser('${u.id || ''}', '${u.email}')" title="Hapus Akun Pengguna">
                <i class="ri-delete-bin-line"></i>
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

export async function handleAdminTestEmail() {
  const alertBox = document.getElementById('adminActionAlert');
  const btn = document.getElementById('btnAdminTestEmail');

  if (alertBox) {
    alertBox.style.display = 'block';
    alertBox.style.background = 'rgba(6, 182, 212, 0.12)';
    alertBox.style.color = 'var(--brand-accent)';
    alertBox.style.border = '1px solid var(--brand-accent)';
    alertBox.textContent = 'Menghubungi Gmail SMTP Gateway (smtp.gmail.com:465)...';
  }
  if (btn) btn.disabled = true;

  const client = getSupabaseClient();
  if (!client) {
    if (alertBox) {
      alertBox.textContent = 'Client Supabase belum siap.';
    }
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(SUPER_ADMIN_EMAIL, {
      redirectTo: window.location.origin
    });

    if (error) throw error;

    if (alertBox) {
      alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
      alertBox.style.color = 'var(--income-green)';
      alertBox.style.border = '1px solid var(--income-green)';
      alertBox.textContent = `Sukses: Email uji coba telah berhasil dikirim ke ${SUPER_ADMIN_EMAIL} melalui Gmail SMTP Gateway. Silakan periksa kotak masuk email Anda.`;
    }
  } catch (err) {
    if (alertBox) {
      alertBox.style.background = 'rgba(239, 68, 68, 0.15)';
      alertBox.style.color = 'var(--expense-red)';
      alertBox.style.border = '1px solid var(--expense-red)';
      alertBox.textContent = 'Gagal mengirim email uji coba: ' + (err.message || 'Terjadi kesalahan pada gateway SMTP.');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function updateBroadcastBannerUI() {
  const banner = document.getElementById('globalBroadcastBanner');
  const textEl = document.getElementById('broadcastMessageText');
  const adminInput = document.getElementById('adminBroadcastInput');
  const adminActive = document.getElementById('adminBroadcastActive');

  const notice = appState.broadcastNotice;
  if (!notice) return;

  if (adminInput) adminInput.value = notice.message || '';
  if (adminActive) adminActive.checked = Boolean(notice.active);

  const isDismissed = sessionStorage.getItem('artha_broadcast_dismissed_' + (notice.updatedAt || '0'));
  if (banner && textEl) {
    if (notice.active && notice.message && !isDismissed) {
      textEl.textContent = notice.message;
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }
}

export function handleSaveAdminBroadcast() {
  const input = document.getElementById('adminBroadcastInput');
  const activeCheckbox = document.getElementById('adminBroadcastActive');

  const message = (input?.value || '').trim();
  const active = Boolean(activeCheckbox?.checked);

  appState.broadcastNotice = {
    message,
    author: appState.user?.email || 'Super Admin',
    active,
    updatedAt: new Date().toISOString()
  };

  saveBroadcastNotice();
  alert('Siaran Pengumuman Global berhasil disimpan dan disinkronkan ke seluruh sistem!');
}
