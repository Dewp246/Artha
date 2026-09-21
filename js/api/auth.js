/* ==========================================================================
   DewpBank - Supabase User Authentication & Session Management
   ========================================================================== */

import { getSupabaseClient, initSupabaseClient } from './supabase.js';
import { appState, loadUserLocalData, resetAppStateData, chartState } from '../state.js';
import { SUPER_ADMIN_EMAIL } from '../config.js';
import { recordKnownUser, subscribeToSupabaseRealtime, stopPresenceChannel } from './presence.js';
import { fetchFromSupabase } from './sync.js';

export function updateAuthUI(isLoggedIn, userEmail) {
  const authScreen = document.getElementById('viewAuthScreen');
  const appContainer = document.getElementById('appContainer');
  const container = document.getElementById('authHeaderContainer');
  const welcomeTitle = document.getElementById('welcomeTitle');
  const settingsUserEmail = document.getElementById('settingsUserEmail');

  const isAdmin = Boolean(isLoggedIn && userEmail && userEmail.toLowerCase() === SUPER_ADMIN_EMAIL);
  const navItemAdmin = document.getElementById('navItemAdmin');
  const bottomNavAdmin = document.getElementById('bottomNavAdmin');

  if (navItemAdmin) navItemAdmin.style.display = isAdmin ? 'flex' : 'none';
  if (bottomNavAdmin) bottomNavAdmin.style.display = isAdmin ? 'flex' : 'none';

  if (!isAdmin) {
    const vAdmin = document.getElementById('viewAdmin');
    if (vAdmin && vAdmin.style.display !== 'none') {
      const tabDash = document.querySelector('.nav-item[data-view="viewDashboard"]');
      if (tabDash) tabDash.click();
    }
  }

  if (isLoggedIn && userEmail) {
    if (authScreen) authScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    const username = userEmail.split('@')[0];
    const initial = username.charAt(0).toUpperCase();

    if (container) {
      container.innerHTML = `
        <div class="sidebar-user-info">
          <div class="user-avatar-circle" title="${userEmail}">${initial}</div>
          <div class="user-details">
            <span class="user-name-text">${username}</span>
            <span class="user-status-text">
              <span class="status-dot-sm"></span> Online (Cloud)
            </span>
          </div>
        </div>
        <button class="btn-sidebar-logout" id="btnLogout" title="Keluar dari Akun (${userEmail})">
          <i class="ri-logout-box-r-line"></i>
        </button>
      `;
      document.getElementById('btnLogout')?.addEventListener('click', () => handleLogoutUser());
    }

    if (welcomeTitle) {
      welcomeTitle.textContent = `Ringkasan Keuangan`;
    }

    if (settingsUserEmail) {
      settingsUserEmail.textContent = userEmail;
    }

    setTimeout(() => {
      if (chartState.cashFlow) chartState.cashFlow.resize();
      if (chartState.expenseDonut) chartState.expenseDonut.resize();
    }, 150);
  } else {
    if (authScreen) authScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';

    if (welcomeTitle) {
      welcomeTitle.textContent = `Ringkasan Keuangan`;
    }
  }
}

export function initSupabaseAuth(onRender) {
  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) return;

  // Guard flag: prevent double-fetch when onAuthStateChange fires SIGNED_IN
  // simultaneously with getSession().then() on page load
  let sessionInitialized = false;

  // Listen to auth state changes
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showResetPasswordScreen();
      return;
    }

    // Skip SIGNED_IN fired by onAuthStateChange if getSession already handled it
    if (event === 'SIGNED_IN' && sessionInitialized) return;

    if (session && session.user) {
      sessionInitialized = true;
      recordKnownUser(session.user.email);
      appState.user = session.user;
      loadUserLocalData(session.user.id);
      updateAuthUI(true, session.user.email);
      await fetchFromSupabase(onRender);
      subscribeToSupabaseRealtime(() => fetchFromSupabase(onRender));
    } else {
      sessionInitialized = false;
      appState.user = null;
      resetAppStateData();
      updateAuthUI(false, null);
      if (typeof onRender === 'function') onRender();
    }
  });

  // Check URL hash for type=recovery (tautan reset password email)
  if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('type%3Drecovery'))) {
    showResetPasswordScreen();
  }

  // Check existing session
  supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
    if (window.location.hash && (window.location.hash.includes('type=recovery') || window.location.hash.includes('type%3Drecovery'))) {
      showResetPasswordScreen();
      return;
    }

    if (session && session.user) {
      // Mark as initialized so onAuthStateChange SIGNED_IN is skipped
      sessionInitialized = true;
      recordKnownUser(session.user.email);
      appState.user = session.user;
      loadUserLocalData(session.user.id);
      updateAuthUI(true, session.user.email);
      await fetchFromSupabase(onRender);
      subscribeToSupabaseRealtime(() => fetchFromSupabase(onRender));
    } else {
      appState.user = null;
      resetAppStateData();
      updateAuthUI(false, null);
      if (typeof onRender === 'function') onRender();
    }
  });
}

export async function handleScreenLogin(e, onRender) {
  if (e) e.preventDefault();
  let email = (document.getElementById('screenLoginEmail')?.value || '').trim();
  const password = (document.getElementById('screenLoginPassword')?.value || '').trim();

  if (!email || !password) {
    showAuthScreenAlert('Silakan masukkan email dan kata sandi.', 'danger');
    return;
  }

  if (!email.includes('@')) {
    email = email + '@gmail.com';
  }

  let supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    initSupabaseClient();
    supabaseClient = getSupabaseClient();
  }

  if (!supabaseClient) {
    showAuthScreenAlert('Tidak dapat menghubungkan ke Supabase. Periksa koneksi internet Anda.', 'danger');
    return;
  }

  showAuthScreenAlert('Sedang memverifikasi akun...', 'info');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message && error.message.includes('Failed to fetch')) {
      showAuthScreenAlert('Gagal terhubung ke database Supabase (Failed to fetch). Jika menggunakan Brave Browser, matikan "Brave Shields" atau Adblocker Anda, lalu coba lagi.', 'danger');
    } else {
      showAuthScreenAlert(`Gagal masuk: ${error.message}`, 'danger');
    }
  } else {
    showAuthScreenAlert('Berhasil masuk! Membuka dashboard...', 'success');
    recordKnownUser(data.user?.email || email);
    appState.user = data.user;
    loadUserLocalData(data.user.id);
    updateAuthUI(true, data.user.email);
    await fetchFromSupabase(onRender);
    subscribeToSupabaseRealtime(() => fetchFromSupabase(onRender));
  }
}

export async function handleScreenRegister(e, onRender) {
  if (e) e.preventDefault();
  let email = (document.getElementById('screenRegisterEmail')?.value || '').trim();
  const password = (document.getElementById('screenRegisterPassword')?.value || '').trim();

  if (!email || !password) {
    showAuthScreenAlert('Silakan lengkapi email dan kata sandi.', 'danger');
    return;
  }

  if (!email.includes('@')) {
    email = email + '@gmail.com';
  }

  let supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    initSupabaseClient();
    supabaseClient = getSupabaseClient();
  }

  if (!supabaseClient) {
    showAuthScreenAlert('Database Supabase belum terhubung.', 'danger');
    return;
  }

  showAuthScreenAlert('Sedang mendaftarkan akun...', 'info');

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    showAuthScreenAlert(`Gagal daftar: ${error.message}`, 'danger');
  } else {
    recordKnownUser(email);
    if (data.session) {
      showAuthScreenAlert('Akun berhasil dibuat! Membuka dashboard...', 'success');
      appState.user = data.user;
      loadUserLocalData(data.user.id);
      updateAuthUI(true, data.user.email);
      await fetchFromSupabase(onRender);
      subscribeToSupabaseRealtime(() => fetchFromSupabase(onRender));
    } else {
      showAuthScreenAlert(`Pendaftaran berhasil! Tautan konfirmasi telah dikirimkan ke email ${email}. Silakan periksa inbox atau folder spam email Anda.`, 'success');
    }
  }
}

export function showForgotPasswordScreen() {
  const tabs = document.querySelector('.auth-tabs');
  const loginForm = document.getElementById('formScreenLogin');
  const registerForm = document.getElementById('formScreenRegister');
  const forgotForm = document.getElementById('formScreenForgotPassword');
  const resetForm = document.getElementById('formScreenResetPassword');

  if (tabs) tabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (resetForm) resetForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'block';
  showAuthScreenAlert('', 'none');
}

export function showResetPasswordScreen() {
  const authScreen = document.getElementById('viewAuthScreen');
  const appContainer = document.getElementById('appContainer');
  const tabs = document.querySelector('.auth-tabs');
  const loginForm = document.getElementById('formScreenLogin');
  const registerForm = document.getElementById('formScreenRegister');
  const forgotForm = document.getElementById('formScreenForgotPassword');
  const resetForm = document.getElementById('formScreenResetPassword');

  if (authScreen) authScreen.style.display = 'flex';
  if (appContainer) appContainer.style.display = 'none';
  if (tabs) tabs.style.display = 'none';
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'none';
  if (resetForm) resetForm.style.display = 'block';
  showAuthScreenAlert('Tautan pemulihan valid. Silakan buat kata sandi baru untuk akun Anda.', 'info');
}

export function showLoginScreenTab() {
  const tabs = document.querySelector('.auth-tabs');
  const tabLogin = document.getElementById('tabScreenLogin');
  const tabRegister = document.getElementById('tabScreenRegister');
  const loginForm = document.getElementById('formScreenLogin');
  const registerForm = document.getElementById('formScreenRegister');
  const forgotForm = document.getElementById('formScreenForgotPassword');
  const resetForm = document.getElementById('formScreenResetPassword');

  if (tabs) tabs.style.display = 'grid';
  if (tabLogin) tabLogin.classList.add('active');
  if (tabRegister) tabRegister.classList.remove('active');
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';
  if (forgotForm) forgotForm.style.display = 'none';
  if (resetForm) resetForm.style.display = 'none';
  showAuthScreenAlert('', 'none');
}

export async function handleForgotPassword(e) {
  if (e) e.preventDefault();
  let email = (document.getElementById('screenForgotEmail')?.value || '').trim();
  if (!email) {
    showAuthScreenAlert('Silakan masukkan alamat email Anda.', 'danger');
    return;
  }

  if (!email.includes('@')) {
    email = email + '@gmail.com';
  }

  let supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    initSupabaseClient();
    supabaseClient = getSupabaseClient();
  }

  if (!supabaseClient) {
    showAuthScreenAlert('Database Supabase belum terhubung.', 'danger');
    return;
  }

  showAuthScreenAlert('Sedang mengirim tautan pemulihan...', 'info');

  const redirectUrl = window.location.origin;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });

  if (error) {
    showAuthScreenAlert(`Gagal mengirim email: ${error.message}`, 'danger');
  } else {
    showAuthScreenAlert(`Tautan atur ulang kata sandi telah dikirim ke ${email}. Silakan periksa inbox atau spam email Anda.`, 'success');
    const input = document.getElementById('screenForgotEmail');
    if (input) input.value = '';
  }
}

export async function handleResetPassword(e) {
  if (e) e.preventDefault();
  const newPass = (document.getElementById('screenNewPassword')?.value || '').trim();
  const confirmPass = (document.getElementById('screenConfirmNewPassword')?.value || '').trim();

  if (!newPass || newPass.length < 6) {
    showAuthScreenAlert('Kata sandi baru minimal harus 6 karakter.', 'danger');
    return;
  }

  if (newPass !== confirmPass) {
    showAuthScreenAlert('Konfirmasi kata sandi tidak cocok. Pastikan kedua input sama.', 'danger');
    return;
  }

  let supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    initSupabaseClient();
    supabaseClient = getSupabaseClient();
  }

  showAuthScreenAlert('Sedang menyimpan kata sandi baru...', 'info');

  const { error } = await supabaseClient.auth.updateUser({
    password: newPass
  });

  if (error) {
    showAuthScreenAlert(`Gagal memperbarui kata sandi: ${error.message}`, 'danger');
  } else {
    showAuthScreenAlert('Kata sandi baru berhasil disimpan! Mengalihkan ke halaman masuk...', 'success');
    if (window.history.replaceState) {
      window.history.replaceState(null, null, window.location.pathname);
    }
    setTimeout(() => {
      showLoginScreenTab();
    }, 1600);
  }
}

export function showAuthScreenAlert(message, type) {
  const alertBox = document.getElementById('authScreenAlert');
  if (!alertBox) return;

  if (type === 'none' || !message) {
    alertBox.style.display = 'none';
    return;
  }

  alertBox.style.display = 'block';
  alertBox.textContent = message;

  if (type === 'danger') {
    alertBox.style.background = 'rgba(244, 63, 94, 0.15)';
    alertBox.style.color = 'var(--expense-red)';
    alertBox.style.border = '1px solid rgba(244, 63, 94, 0.3)';
  } else if (type === 'success') {
    alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
    alertBox.style.color = 'var(--income-green)';
    alertBox.style.border = '1px solid rgba(16, 185, 129, 0.3)';
  } else {
    alertBox.style.background = 'rgba(6, 182, 212, 0.15)';
    alertBox.style.color = 'var(--accent-cyan)';
    alertBox.style.border = '1px solid rgba(6, 182, 212, 0.3)';
  }
}

export async function handleLogoutUser(onRender) {
  await stopPresenceChannel();

  const supabaseClient = getSupabaseClient();
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {}
  }
  appState.user = null;
  resetAppStateData();
  updateAuthUI(false, null);
  if (typeof onRender === 'function') onRender();

  const modalSettings = document.getElementById('modalSettings');
  if (modalSettings) modalSettings.classList.remove('active');
}
