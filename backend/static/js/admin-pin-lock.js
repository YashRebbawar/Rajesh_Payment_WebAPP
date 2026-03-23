'use strict';

(function () {
  const body = document.body;
  if (!body || body.dataset.adminPinPage !== 'true') return;

  const overlay = document.getElementById('admin-pin-overlay');
  const form = document.getElementById('admin-pin-form');
  const input = document.getElementById('admin-pin-input');
  const submitButton = document.getElementById('admin-pin-submit');
  const errorNode = document.getElementById('admin-pin-error');
  const statusNode = document.getElementById('admin-pin-status-text');
  const csrfToken = body.dataset.csrfToken || '';
  const configured = body.dataset.adminPinConfigured === 'true';
  const bootLocked = body.dataset.adminPinBootLocked === 'true';
  const idleTimeoutMs = Number(body.dataset.adminPinIdleTimeout || '0') * 1000;

  let locked = body.dataset.adminPinVerified !== 'true';
  let verifyInFlight = false;
  let idleTimer = null;
  let blurLockTimer = null;

  function updateBodyState() {
    body.classList.add('admin-pin-page');
    body.classList.toggle('admin-pin-locked', locked);
    if (!overlay) return;
    overlay.classList.toggle('is-visible', locked);
    overlay.setAttribute('aria-hidden', locked ? 'false' : 'true');
  }

  function setStatus(message, isError = false) {
    if (!errorNode) return;
    errorNode.textContent = isError ? message : '';
    if (!isError && statusNode && message) statusNode.textContent = message;
  }

  function setLoading(isLoading) {
    verifyInFlight = isLoading;
    if (!submitButton) return;
    submitButton.disabled = isLoading || !configured;
    submitButton.classList.toggle('is-loading', isLoading);
  }

  function dispatchLockEvent(name, detail = {}) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function startIdleTimer() {
    if (!idleTimeoutMs || locked) return;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      lockDashboard('idle_timeout');
    }, idleTimeoutMs);
  }

  function resetIdleTimer() {
    if (locked) return;
    startIdleTimer();
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify(payload || {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function unlockDashboard(pin) {
    if (!configured) {
      setStatus('Security PIN is not configured on the server.', true);
      return;
    }
    setLoading(true);
    setStatus('');
    try {
      await postJson('/api/admin/pin/verify', { pin });
      locked = false;
      body.dataset.adminPinVerified = 'true';
      updateBodyState();
      startIdleTimer();
      dispatchLockEvent('admin-pin:unlocked');
      if (bootLocked) {
        window.location.reload();
        return;
      }
      if (input) input.value = '';
      if (statusNode) {
        statusNode.textContent = 'Dashboard unlocked. Focus loss or inactivity will relock it.';
      }
    } catch (error) {
      const retryAfter = error.data?.retry_after_seconds;
      const message = retryAfter
        ? `Locked after repeated PIN failures. Try again in ${retryAfter}s.`
        : (error.data?.message || error.message || 'Unable to verify PIN');
      setStatus(message, true);
      if (input) {
        input.value = '';
        input.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  async function lockDashboard(reason) {
    if (locked || verifyInFlight) return;
    locked = true;
    body.dataset.adminPinVerified = 'false';
    updateBodyState();
    window.clearTimeout(idleTimer);
    if (statusNode) {
      statusNode.textContent = reason === 'idle_timeout'
        ? 'Session relocked after inactivity.'
        : 'Session relocked because the dashboard lost focus.';
    }
    setStatus('');
    dispatchLockEvent('admin-pin:locked', { reason });
    try {
      await postJson('/api/admin/pin/lock', { reason });
    } catch (error) {
      console.error('Admin PIN relock failed:', error);
    } finally {
      if (input) input.focus();
    }
  }

  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const pin = (input?.value || '').trim();
      if (!pin) {
        setStatus('Enter the security PIN to continue.', true);
        input?.focus();
        return;
      }
      unlockDashboard(pin);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      lockDashboard('visibility_hidden');
    }
  });

  window.addEventListener('blur', () => {
    window.clearTimeout(blurLockTimer);
    blurLockTimer = window.setTimeout(() => lockDashboard('window_blur'), 120);
  });

  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  });

  window.adminPinLock = {
    isLocked: () => locked,
    isUnlocked: () => !locked
  };

  updateBodyState();
  if (!locked) {
    startIdleTimer();
  } else {
    input?.focus();
  }
})();
