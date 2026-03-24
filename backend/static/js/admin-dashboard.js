/* Add admin-page class immediately */
document.documentElement.classList.add('admin-page-root');
if (document.body) { document.body.classList.add('admin-page'); }
else { document.addEventListener('DOMContentLoaded', () => document.body.classList.add('admin-page')); }

'use strict';

/* ── state ── */
let currentUnifiedEditAccountId   = null;
let currentUnifiedEditAccountName = null;
let currentBalancePaymentId       = null;
let currentBalanceAccountId       = null;
let migrateDropdownOpen           = false;
let dashboardPollingStarted       = false;
const dashboardIntervalIds        = [];

function isAdminPinUnlocked() {
  return !window.adminPinLock || window.adminPinLock.isUnlocked();
}

function stopDashboardPolling() {
  while (dashboardIntervalIds.length) {
    clearInterval(dashboardIntervalIds.pop());
  }
  dashboardPollingStarted = false;
}

function registerDashboardInterval(callback, intervalMs) {
  const id = setInterval(() => {
    if (isAdminPinUnlocked()) callback();
  }, intervalMs);
  dashboardIntervalIds.push(id);
}

/* ── password rules ── */
const passwordRules = {
  length:  v => v.length >= 8 && v.length <= 15,
  upper:   v => /[A-Z]/.test(v),
  lower:   v => /[a-z]/.test(v),
  number:  v => /\d/.test(v),
  special: v => /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?]/.test(v)
};
function isPasswordValid(pw) { return Object.values(passwordRules).every(fn => fn(pw)); }

/* ══ TOAST ══ */
function showToast(msg, type = 'success') {
  let el = document.getElementById('pf-admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pf-admin-toast'; el.className = 'pf-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'pf-toast ' + type;
  void el.offsetWidth;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 3200);
}
function showSuccessMessage(m) { showToast(m, 'success'); }
function showErrorMessage(m)   { showToast(m, 'error'); }

/* ══ MEASURE BAR HEIGHT ══ */
function measureBarHeight() {
  const bar = document.querySelector('.commission-stats-widget');
  if (bar) document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
}

function resetCommissionWidgetScroll() {
  const bar = document.querySelector('.commission-stats-widget');
  if (!bar) return;
  bar.scrollLeft = 0;
}

function setBadgeCount(el, count) {
  if (!el) return;
  const safeCount = Math.max(Number(count) || 0, 0);
  el.textContent = safeCount;
  el.style.display = safeCount > 0 ? '' : 'none';
}

async function refreshAdminNotificationBadges() {
  if (!isAdminPinUnlocked()) return;

  try {
    const [paymentData, chatData] = await Promise.all([
      fetch('/api/admin/notifications').then(r => r.json()),
      fetch('/api/admin/chat-users-with-pending').then(r => r.json())
    ]);

    const pendingPaymentsCount = paymentData.success && Array.isArray(paymentData.notifications)
      ? paymentData.notifications.length
      : 0;
    const pendingChatThreadsCount = chatData.success && Array.isArray(chatData.users)
      ? chatData.users.length
      : 0;

    setBadgeCount(document.getElementById('pending-payments-badge'), pendingPaymentsCount);
    setBadgeCount(document.getElementById('mobile-payments-badge'), pendingPaymentsCount);
    setBadgeCount(document.getElementById('quick-migrate-badge'), pendingChatThreadsCount);
  } catch (e) {
    console.error('Failed to refresh admin notification badges:', e);
  }
}

function updateMobileDashboardTabState(tab) {
  const usersSection = document.getElementById('users-tab');
  const paymentsSection = document.getElementById('payments-tab');
  const commissionBar = document.querySelector('.commission-stats-widget');
  const isMobile = window.innerWidth <= 768;

  if (usersSection) usersSection.style.display = tab === 'users' ? 'flex' : 'none';
  if (paymentsSection) paymentsSection.style.display = tab === 'payments' ? 'flex' : 'none';

  if (commissionBar) {
    commissionBar.style.display = !isMobile || tab === 'users' ? '' : 'none';
    if (!isMobile || tab === 'users') resetCommissionWidgetScroll();
  }
}

/* ══ COMMISSION STATS ══ */
async function loadCommissionStats(year = null, month = null) {
  if (!isAdminPinUnlocked()) return;
  try {
    let url = '/api/admin/commission-stats';
    if (year && month) url += `?year=${year}&month=${month}`;
    const data = await fetch(url).then(r => r.json());
    if (!data.success) return;
    const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('total-platform-fee',   fmt(data.platform_fee));
    s('total-deposits',       fmt(data.total_deposits));
    s('transaction-count',    data.transaction_count);
    s('monthly-deposits',     fmt(data.monthly_deposits));
    s('monthly-fee',          fmt(data.monthly_fee));
    s('pending-platform-fee', fmt(data.pending_fee));
    s('pending-deposits',     fmt(data.pending_deposits));
  } catch (e) { console.error(e); }
}

function getSelectedCommissionPeriod() {
  const sel = document.getElementById('month-selector');
  if (!sel || !sel.value) return { year: null, month: null };
  const [year, month] = sel.value.split('-').map(Number);
  if (!year || !month) return { year: null, month: null };
  return { year, month };
}

function populateMonthSelector() {
  const sel = document.getElementById('month-selector');
  if (!sel) return;
  sel.innerHTML = '';
  const now = new Date(), cy = now.getFullYear(), cm = now.getMonth() + 1;
  const list = [];
  for (let y = 2026; y <= cy; y++)
    for (let m = (y === 2026 ? 1 : 1); m <= (y === cy ? cm : 12); m++) list.push({ y, m });
  list.reverse().forEach((it, i) => {
    const label = new Date(it.y, it.m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = `${it.y}-${it.m}`;
    opt.textContent = i === 0 ? `${label} · Current` : label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', function () {
    const { year, month } = getSelectedCommissionPeriod();
    loadCommissionStats(year, month);
  });
}

async function loadUsersNoAccountType() {
  if (!isAdminPinUnlocked()) return;
  try {
    const data = await fetch('/api/admin/users-no-account-type').then(r => r.json());
    if (!data.success) return;
    const c = document.getElementById('no-account-type-count');
    const l = document.getElementById('no-account-type-list');
    if (c) c.textContent = data.count;
    if (l) {
      if (data.count > 0) { const str = data.users.map(u => u.email).join(', '); l.textContent = str.length > 50 ? str.slice(0, 50) + '…' : str; }
      else l.textContent = 'None';
    }
  } catch (e) { console.error(e); }
}

/* ══ USER CARD EXPAND / COLLAPSE ══ */
function initUserCards() {
  document.querySelectorAll('.admin-user-card').forEach(card => {
    const header = card.querySelector('.admin-user-header');
    if (!header) return;
    card.classList.remove('expanded');
    header.addEventListener('click', function (e) {
      if (e.target.closest('.user-row-actions')) return;
      card.classList.toggle('expanded');
    });
  });
}

/* ══ SEARCH / FILTER ══ */
function filterUsers(q) {
  q = (q || '').toLowerCase().trim();
  document.querySelectorAll('.admin-user-card').forEach(card => {
    const name  = card.querySelector('.user-details h3')?.textContent.toLowerCase() || '';
    const email = card.querySelector('.user-email')?.textContent.toLowerCase() || '';
    const accountNames = Array.from(card.querySelectorAll('.account-name')).map(el => el.textContent.toLowerCase()).join(' ');
    card.style.display = (name.includes(q) || email.includes(q) || accountNames.includes(q)) ? '' : 'none';
  });
}

function filterPayments() {
  const q   = (document.getElementById('payment-search')?.value || '').toLowerCase();
  const cur = document.getElementById('currency-filter')?.value || 'all';
  document.querySelectorAll('.pending-payment-card').forEach(card => {
    const matchEmail = (card.dataset.userEmail || '').toLowerCase().includes(q);
    const matchCur   = cur === 'all' || card.dataset.currency === cur;
    card.classList.toggle('hidden', !(matchEmail && matchCur));
  });
}

/* ══ UNIFIED EDIT MODAL ══ */
function openUnifiedEditModal(accountId, mtLogin, mtServer, password, leverage, balance, nickname) {
  currentUnifiedEditAccountId   = accountId;
  currentUnifiedEditAccountName = nickname || 'Account';
  document.getElementById('unified-mt-login').value  = mtLogin;
  document.getElementById('unified-mt-server').value = mtServer;
  document.getElementById('unified-password').value  = password;
  document.getElementById('unified-leverage').value  = leverage;
  document.getElementById('unified-balance').value   = balance;
  document.getElementById('unified-edit-modal').style.display = 'flex';
}
function closeUnifiedEditModal() {
  document.getElementById('unified-edit-modal').style.display = 'none';
  currentUnifiedEditAccountId = currentUnifiedEditAccountName = null;
}
async function submitUnifiedEditForm(e) {
  e.preventDefault();
  if (!currentUnifiedEditAccountId) { showErrorMessage('Account ID not set'); return; }
  const v = id => document.getElementById(id).value.trim();
  const mtLogin = v('unified-mt-login'), mtServer = v('unified-mt-server');
  const password = document.getElementById('unified-password').value;
  const leverage = v('unified-leverage');
  const balance  = parseFloat(document.getElementById('unified-balance').value);
  if (!mtLogin || !mtServer || !password || !leverage || isNaN(balance)) { showErrorMessage('Please fill in all fields'); return; }
  if (!isPasswordValid(password)) { showErrorMessage('Password: 8–15 chars, upper, lower, number, special char'); return; }
  const saveBtn = document.getElementById('unified-save-btn');
  const cancelBtn = document.getElementById('unified-cancel-btn');
  saveBtn.disabled = cancelBtn.disabled = true;
  saveBtn.textContent = 'Saving…';
  try {
    const id = currentUnifiedEditAccountId;
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    const [r1, r2, r3] = await Promise.all([
      post(`/api/admin/update-account-mt/${id}`,      { mt_login: mtLogin, mt_server: mtServer }),
      post(`/api/admin/update-account-details/${id}`, { password, leverage }),
      post(`/api/admin/update-account-balance/${id}`, { balance })
    ]);
    if (r1.success && r2.success && r3.success) {
      closeUnifiedEditModal();
      showSuccessMessage(currentUnifiedEditAccountName + ' updated!');
      setTimeout(() => location.reload(), 1500);
    } else {
      showErrorMessage('Error: ' + (r1.message || r2.message || r3.message || 'unknown'));
      saveBtn.disabled = cancelBtn.disabled = false;
      saveBtn.textContent = 'Save All Changes';
    }
  } catch (err) {
    showErrorMessage('Network error');
    saveBtn.disabled = cancelBtn.disabled = false;
    saveBtn.textContent = 'Save All Changes';
  }
}

/* ══ BALANCE MODAL ══ */
function openBalanceModal(paymentId) {
  currentBalancePaymentId = paymentId; currentBalanceAccountId = null;
  const card = [...document.querySelectorAll('.pending-payment-card')].find(c =>
    c.querySelector('.approve-btn')?.getAttribute('onclick')?.includes(paymentId)
  );
  if (card) currentBalanceAccountId = card.dataset.accountId || null;
  document.getElementById('balance-input').value = '';
  document.getElementById('balance-modal').style.display = 'flex';
}
function openBalanceModalForAccount(accountId) {
  currentBalanceAccountId = accountId; currentBalancePaymentId = null;
  const card = document.querySelector(`[data-account-id="${accountId}"]`);
  document.getElementById('balance-input').value = card ? (card.querySelector('.balance-amount')?.textContent || '0') : '';
  document.getElementById('balance-modal').style.display = 'flex';
}
function closeBalanceModal() {
  document.getElementById('balance-modal').style.display = 'none';
  currentBalancePaymentId = currentBalanceAccountId = null;
}
async function submitBalanceForm(e) {
  e.preventDefault();
  const balance = parseFloat(document.getElementById('balance-input').value);
  if (isNaN(balance) || balance < 0) { showErrorMessage('Enter a valid balance'); return; }
  try {
    let accountId = currentBalanceAccountId;
    if (!accountId && currentBalancePaymentId) {
      const card = [...document.querySelectorAll('.pending-payment-card')].find(c =>
        c.querySelector('.approve-btn')?.getAttribute('onclick')?.includes(currentBalancePaymentId)
      );
      accountId = card?.dataset.accountId;
    }
    if (!accountId) { showErrorMessage('Account not found'); return; }
    const data = await fetch(`/api/admin/update-account-balance/${accountId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ balance })
    }).then(r => r.json());
    if (data.success) { closeBalanceModal(); showSuccessMessage('Balance updated!'); setTimeout(() => location.reload(), 1400); }
    else showErrorMessage('Error: ' + data.message);
  } catch { showErrorMessage('Network error'); }
}

/* ══ NOTIFICATIONS ══ */
async function loadNewUserNotifications() {
  if (!isAdminPinUnlocked()) return;
  try {
    const data = await fetch('/api/admin/new-user-notifications').then(r => r.json());
    if (data.success) data.notifications.forEach(n => {
      const el = document.querySelector(`[data-user-id="${n.user_id}"].new-user-badge`);
      if (el) el.style.display = 'inline-block';
    });
  } catch {}
}
async function loadNewAccountNotifications() {
  if (!isAdminPinUnlocked()) return;
  try {
    const data = await fetch('/api/admin/new-account-notifications').then(r => r.json());
    if (data.success) data.notifications.forEach(n => {
      const el = document.querySelector(`[data-account-id="${n.account_id}"].new-account-badge-small`);
      if (el) el.style.display = 'inline-block';
    });
  } catch {}
}

/* ══ DELETE USER ══ */
async function deleteUser(userId) {
  showConfirmModal('Delete user?', 'Permanently deletes this user and all their accounts.', async () => {
    try {
      const data = await fetch(`/api/admin/delete-user/${userId}`, { method: 'DELETE' }).then(r => r.json());
      if (data.success) location.reload();
      else showErrorMessage('Error: ' + data.message);
    } catch { showErrorMessage('Failed to delete user'); }
  });
}

/* ══ SCREENSHOT ══ */
function viewScreenshot(b64) {
  document.getElementById('screenshot-image').src = 'data:image/jpeg;base64,' + b64;
  document.getElementById('screenshot-modal').style.display = 'block';
}
function closeScreenshotModal() { document.getElementById('screenshot-modal').style.display = 'none'; }

/* ══ CONFIRM MODAL ══ */
function showConfirmModal(title, body, onConfirm) {
  document.getElementById('pf-confirm')?.remove();
  const m = document.createElement('div');
  m.id = 'pf-confirm'; m.className = 'confirm-modal';
  m.innerHTML = `<div class="confirm-modal-content"><h3>${title}</h3><p>${body}</p><div class="confirm-modal-actions"><button class="confirm-cancel-btn">Cancel</button><button class="confirm-ok-btn">Confirm</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('.confirm-cancel-btn').onclick = () => m.remove();
  m.querySelector('.confirm-ok-btn').onclick = () => { m.remove(); onConfirm(); };
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

/* ══ APPROVE / REJECT ══ */
function getCsrfToken() {
  const token = document.querySelector('input[name="csrf_token"]')?.value;
  if (!token) {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }
  return token;
}

async function approvePayment(paymentId) {
  showConfirmModal('Approve payment?', "Approve and credit the user's account?", async () => {
    try {
      const csrfToken = getCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;
      
      const data = await fetch(`/api/admin/approve-payment/${paymentId}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({})
      }).then(r => r.json());
      if (data.success) { showSuccessMessage('Payment approved!'); setTimeout(() => location.reload(), 1300); }
      else showErrorMessage('Error: ' + data.message);
    } catch { showErrorMessage('Failed to approve'); }
  });
}

async function rejectPayment(paymentId) {
  showConfirmModal('Reject payment?', 'This will reject the payment and notify the user.', async () => {
    try {
      const csrfToken = getCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['X-CSRFToken'] = csrfToken;
      
      const data = await fetch(`/api/admin/reject-payment/${paymentId}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({})
      }).then(r => r.json());
      if (data.success) { showSuccessMessage('Payment rejected.'); setTimeout(() => location.reload(), 1300); }
      else showErrorMessage('Error: ' + data.message);
    } catch { showErrorMessage('Failed to reject'); }
  });
}

/* ══ MIGRATE DROPDOWN ══ */
function getMigrateEl() {
  let el = document.getElementById('migrate-dropdown');
  if (!el) {
    el = document.createElement('div');
    el.id = 'migrate-dropdown'; el.className = 'migrate-dropdown';
    const mob = window.innerWidth <= 768;
    Object.assign(el.style, { position: 'fixed', top: '60px', zIndex: '1000', display: 'none', right: mob ? '45px' : '45px', left: mob ? '10px' : 'auto', width: mob ? 'auto' : '288px', maxHeight: '360px', overflowY: 'auto' });
    document.body.appendChild(el);
  }
  return el;
}
async function toggleMigrateDropdown() {
  event.preventDefault(); event.stopPropagation();
  const el = getMigrateEl();
  if (migrateDropdownOpen) { el.style.display = 'none'; migrateDropdownOpen = false; return; }
  el.style.display = 'block'; migrateDropdownOpen = true;
  el.innerHTML = '<div style="padding:14px;text-align:center;font-size:13px;color:rgba(26,21,16,.4);">Loading…</div>';
  await refreshMigrateList(el);
}
async function refreshMigrateList(el) {
  try {
    const data = await fetch('/api/admin/chat-users-with-pending').then(r => r.json());
    setBadgeCount(
      document.getElementById('quick-migrate-badge'),
      data.success && Array.isArray(data.users) ? data.users.length : 0
    );
    if (data.success && data.users.length > 0) {
      el.innerHTML = data.users.map(u => `<div class="migrate-user-item" onclick="selectMigrateUser('${u.user_id}','${u.name.replace(/'/g,"\\'")}')"><div><div class="migrate-item-name">${u.name}</div><div class="migrate-item-email">${u.email}</div></div><div class="migrate-item-badge">${u.pending_count}</div></div>`).join('');
    } else {
      el.innerHTML = '<div style="padding:18px;text-align:center;font-family:\'Fraunces\',serif;font-size:14px;font-weight:700;color:rgba(26,21,16,.35);">No pending chats</div>';
    }
  } catch { el.innerHTML = '<div style="padding:14px;text-align:center;font-size:13px;color:#c0392b;">Error loading</div>'; }
}
function selectMigrateUser(userId, userName) {
  const el = document.getElementById('migrate-dropdown');
  if (el) { el.style.display = 'none'; migrateDropdownOpen = false; }
  openChatModal(userId, userName);
  showSuccessMessage('Chat opened with ' + userName);
}
document.addEventListener('click', e => {
  const btn = document.querySelector('.quick-migrate-header-btn');
  const el  = document.getElementById('migrate-dropdown');
  if (el && btn && !btn.contains(e.target) && !el.contains(e.target)) { el.style.display = 'none'; migrateDropdownOpen = false; }
});
setInterval(async () => { if (!migrateDropdownOpen) return; const el = document.getElementById('migrate-dropdown'); if (el) await refreshMigrateList(el); }, 5000);

/* ══ DOM READY ══ */
document.addEventListener('DOMContentLoaded', function () {
  function startDashboardPolling() {
    if (dashboardPollingStarted || !isAdminPinUnlocked()) return;
    dashboardPollingStarted = true;
    const refreshDashboardMetrics = () => {
      const { year, month } = getSelectedCommissionPeriod();
      loadCommissionStats(year, month);
      loadUsersNoAccountType();
    };

    refreshDashboardMetrics();
    refreshAdminNotificationBadges();
    requestAnimationFrame(resetCommissionWidgetScroll);
    loadNewUserNotifications();
    loadNewAccountNotifications();

    registerDashboardInterval(refreshDashboardMetrics, 30000);
    registerDashboardInterval(refreshAdminNotificationBadges, 15000);
    registerDashboardInterval(loadNewAccountNotifications, 5000);
    registerDashboardInterval(async () => {
      try {
        const data = await fetch('/api/admin/notifications').then(r => r.json());
        const cur = document.querySelectorAll('.pending-payment-card:not(.hidden)').length;
        if (data.success && data.notifications.length > cur) location.reload();
      } catch {}
    }, 15000);
  }

  measureBarHeight();
  resetCommissionWidgetScroll();
  window.addEventListener('resize', () => {
    measureBarHeight();
    resetCommissionWidgetScroll();
  });
  document.body.classList.add('admin-page');

  populateMonthSelector();

  /* profile dropdown */
  const profileToggle   = document.getElementById('profile-toggle');
  const profileDropdown = document.getElementById('profile-dropdown');
  if (profileToggle && profileDropdown) {
    profileToggle.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); profileDropdown.classList.toggle('active'); });
    document.addEventListener('click', e => { if (!document.querySelector('.user-profile-wrapper')?.contains(e.target)) profileDropdown.classList.remove('active'); });
  }

  /* member since */
  const createdEl = document.querySelector('[data-user-created-at]');
  const msEl = document.getElementById('member-since');
  if (createdEl && msEl) msEl.textContent = new Date(createdEl.getAttribute('data-user-created-at')).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  /* hamburger */
  const hamburger  = document.getElementById('hamburger-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => { mobileMenu.classList.toggle('active'); hamburger.classList.toggle('active'); });
    document.addEventListener('click', e => { if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) { mobileMenu.classList.remove('active'); hamburger.classList.remove('active'); } });
  }

  /* mobile tabs */
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateMobileDashboardTabState(tab);
    });
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      const u = document.getElementById('users-tab'); if (u) u.style.display = '';
      const p = document.getElementById('payments-tab'); if (p) p.style.display = '';
      const bar = document.querySelector('.commission-stats-widget'); if (bar) bar.style.display = '';
    } else {
      const activeTab = document.querySelector('.mobile-tab-btn.active')?.dataset.tab || 'users';
      updateMobileDashboardTabState(activeTab);
    }
  });

  if (window.innerWidth <= 768) {
    const activeTab = document.querySelector('.mobile-tab-btn.active')?.dataset.tab || 'users';
    updateMobileDashboardTabState(activeTab);
  }

  /* view toggle */
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const list = document.querySelector('.admin-users-list, .admin-users-grid');
      if (list) list.className = this.dataset.view === 'grid' ? 'admin-users-grid' : 'admin-users-list';
    });
  });

  initUserCards();

  document.getElementById('admin-user-search')?.addEventListener('input', function () { filterUsers(this.value); });
  document.getElementById('mobile-admin-user-search')?.addEventListener('input', function () { filterUsers(this.value); });
  document.getElementById('payment-search')?.addEventListener('input', filterPayments);
  document.getElementById('currency-filter')?.addEventListener('change', filterPayments);

  document.getElementById('unified-edit-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeUnifiedEditModal(); });
  document.getElementById('balance-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeBalanceModal(); });
  document.getElementById('screenshot-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeScreenshotModal(); });

  if (isAdminPinUnlocked()) startDashboardPolling();
  document.addEventListener('admin-pin:locked', stopDashboardPolling);
  document.addEventListener('admin-pin:unlocked', startDashboardPolling);
});

function updatePaymentTimes() {}

function showBankDetailsPopup(event, bankAccount, ifscCode) {
  event.preventDefault();
  event.stopPropagation();
  document.getElementById('bank-account-value').textContent = bankAccount || 'N/A';
  document.getElementById('bank-ifsc-value').textContent = ifscCode || 'N/A';
  document.getElementById('bank-details-modal').classList.add('active');
}

function closeBankDetailsModal() {
  document.getElementById('bank-details-modal').classList.remove('active');
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 2000);
    showToast('Copied to clipboard!', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function copyDetailField(elementId, btn) {
  const text = document.getElementById(elementId)?.textContent || '';
  if (!text) { showToast('Nothing to copy', 'error'); return; }
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 2000);
    showToast('Copied!', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

function copyBankDetails(account, ifsc, btn) {
  const text = `Account: ${account}\nIFSC: ${ifsc}`;
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>Copy';
    }, 2000);
    showToast('Bank details copied!', 'success');
  }).catch(() => showToast('Failed to copy', 'error'));
}

document.getElementById('bank-details-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeBankDetailsModal();
});
