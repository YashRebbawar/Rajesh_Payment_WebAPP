'use strict';

(function () {
  const body = document.body;
  if (!body || body.dataset.adminPinPage !== 'true') return;

  const overlay = document.getElementById('admin-pin-overlay');
  const form = document.getElementById('admin-pin-form');
  const input = document.getElementById('admin-pin-input');
  const submitButton = document.getElementById('admin-pin-submit');
  const biometricPanel = document.getElementById('admin-pin-biometric');
  const biometricUnlockButton = document.getElementById('admin-biometric-unlock');
  const biometricEnrollButton = document.getElementById('admin-biometric-enroll');
  const errorNode = document.getElementById('admin-pin-error');
  const statusNode = document.getElementById('admin-pin-status-text');
  const csrfToken = body.dataset.csrfToken || '';
  const configured = body.dataset.adminPinConfigured === 'true';
  const bootLocked = body.dataset.adminPinBootLocked === 'true';
  const idleTimeoutMs = Number(body.dataset.adminPinIdleTimeout || '0') * 1000;

  let locked = body.dataset.adminPinVerified !== 'true';
  let verifyInFlight = false;
  let biometricRegistered = false;
  let biometricSupported = false;
  let idleTimer = null;
  let blurLockTimer = null;

  function hasWebAuthnBrowserSupport() {
    return Boolean(
      window.isSecureContext &&
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function'
    );
  }

  function isLikelyIOSBrowser() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function base64UrlToBuffer(value) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
      output[index] = raw.charCodeAt(index);
    }
    return output.buffer;
  }

  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function prepareCredentialOptions(options) {
    if (options.challenge) options.challenge = base64UrlToBuffer(options.challenge);
    if (options.user?.id) options.user.id = base64UrlToBuffer(options.user.id);
    if (Array.isArray(options.excludeCredentials)) {
      options.excludeCredentials = options.excludeCredentials.map(credential => ({
        ...credential,
        id: base64UrlToBuffer(credential.id)
      }));
    }
    if (Array.isArray(options.allowCredentials)) {
      options.allowCredentials = options.allowCredentials.map(credential => ({
        ...credential,
        id: base64UrlToBuffer(credential.id)
      }));
    }
    return options;
  }

  function credentialToJson(credential) {
    const response = credential.response;
    const output = {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults()
    };

    if (response.attestationObject) {
      output.response = {
        attestationObject: bufferToBase64Url(response.attestationObject),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON)
      };
      return output;
    }

    output.response = {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null
    };
    return output;
  }

  function updateBodyState() {
    body.classList.add('admin-pin-page');
    body.classList.toggle('admin-pin-locked', locked);
    if (!overlay) return;
    overlay.classList.toggle('is-visible', locked);
    // Use inert instead of aria-hidden to prevent focus conflicts
    if (locked) {
      overlay.removeAttribute('inert');
    } else {
      overlay.setAttribute('inert', '');
    }
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

  function setBiometricLoading(isLoading) {
    if (biometricUnlockButton) biometricUnlockButton.disabled = isLoading;
    if (biometricEnrollButton) biometricEnrollButton.disabled = isLoading;
  }

  function updateBiometricState() {
    if (!biometricPanel) return;
    const showPanel = biometricSupported && configured;
    biometricPanel.hidden = !showPanel;
    if (biometricUnlockButton) {
      biometricUnlockButton.hidden = !biometricRegistered;
    }
    if (biometricEnrollButton) {
      biometricEnrollButton.hidden = biometricRegistered;
    }
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

  async function loadBiometricStatus() {
    if (!hasWebAuthnBrowserSupport()) {
      updateBiometricState();
      return;
    }

    let platformAuthenticatorAvailable = isLikelyIOSBrowser();
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        platformAuthenticatorAvailable =
          platformAuthenticatorAvailable ||
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch (error) {
      platformAuthenticatorAvailable = isLikelyIOSBrowser();
    }

    try {
      const response = await fetch('/api/admin/biometric/status');
      const data = await response.json();
      biometricSupported = Boolean(data.available) && platformAuthenticatorAvailable;
      biometricRegistered = Boolean(data.registered);
    } catch (error) {
      biometricSupported = false;
    }
    updateBiometricState();
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

  async function enrollBiometric() {
    const pin = (input?.value || '').trim();
    if (!pin) {
      setStatus('Enter the PIN first, then enable fingerprint or face unlock.', true);
      input?.focus();
      return;
    }

    setBiometricLoading(true);
    setLoading(true);
    setStatus('Starting biometric enrollment...');
    try {
      await postJson('/api/admin/pin/verify', { pin });
      const options = await postJson('/api/admin/biometric/register/options', {});
      const credential = await navigator.credentials.create({
        publicKey: prepareCredentialOptions(options)
      });
      if (!credential) throw new Error('Biometric enrollment was cancelled.');
      await postJson('/api/admin/biometric/register/verify', credentialToJson(credential));
      biometricRegistered = true;
      locked = false;
      body.dataset.adminPinVerified = 'true';
      updateBodyState();
      updateBiometricState();
      startIdleTimer();
      dispatchLockEvent('admin-pin:unlocked');
      if (input) input.value = '';
      if (bootLocked) {
        window.location.reload();
        return;
      }
      if (statusNode) statusNode.textContent = 'Biometric unlock is enabled on this device.';
    } catch (error) {
      setStatus(error.data?.message || error.message || 'Unable to enable biometric unlock', true);
    } finally {
      setLoading(false);
      setBiometricLoading(false);
    }
  }

  async function unlockWithBiometric() {
    setBiometricLoading(true);
    setStatus('Waiting for fingerprint or face verification...');
    try {
      const options = await postJson('/api/admin/biometric/auth/options', {});
      const credential = await navigator.credentials.get({
        publicKey: prepareCredentialOptions(options)
      });
      if (!credential) throw new Error('Biometric verification was cancelled.');
      await postJson('/api/admin/biometric/auth/verify', credentialToJson(credential));
      locked = false;
      body.dataset.adminPinVerified = 'true';
      updateBodyState();
      startIdleTimer();
      dispatchLockEvent('admin-pin:unlocked');
      if (bootLocked) {
        window.location.reload();
        return;
      }
      if (statusNode) {
        statusNode.textContent = 'Dashboard unlocked with biometric verification.';
      }
    } catch (error) {
      setStatus(error.data?.message || error.message || 'Biometric verification failed', true);
    } finally {
      setBiometricLoading(false);
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

  biometricEnrollButton?.addEventListener('click', enrollBiometric);
  biometricUnlockButton?.addEventListener('click', unlockWithBiometric);

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
  loadBiometricStatus();
  if (!locked) {
    startIdleTimer();
  } else {
    input?.focus();
  }
})();
