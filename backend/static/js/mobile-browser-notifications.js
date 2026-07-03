(function () {
  const body = document.body;
  if (!body || body.dataset.userAuthenticated !== 'true') return;

  const isAdminPinLocked = body.dataset.adminPinPage === 'true' && body.dataset.adminPinVerified !== 'true';
  if (isAdminPinLocked) {
    document.addEventListener('admin-pin:unlocked', function () {
      window.setTimeout(function () {
        if (!window.PrintFreeMobileNotificationsStarted) startMobileBrowserNotifications();
      }, 250);
    }, { once: true });
    return;
  }

  startMobileBrowserNotifications();
})();

function startMobileBrowserNotifications() {
  window.PrintFreeMobileNotificationsStarted = true;
  const body = document.body;

  const role = body.dataset.userIsAdmin === 'true' ? 'admin' : 'user';
  const userId = body.dataset.userId || role;
  const storageKey = `pf-mobile-notification-seen:v1:${role}:${userId}`;
  const maxSeenIds = 120;
  let pollingTimer = null;
  let enableButton = null;

  function loadSeenIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch (error) {
      return new Set();
    }
  }

  function saveSeenIds(ids) {
    const trimmed = Array.from(ids).slice(-maxSeenIds);
    localStorage.setItem(storageKey, JSON.stringify(trimmed));
  }

  function canUseNativeNotifications() {
    return 'Notification' in window;
  }

  function notificationPermission() {
    return canUseNativeNotifications() ? Notification.permission : 'unsupported';
  }

  function showToast(title, bodyText, url) {
    const toast = document.createElement('button');
    toast.type = 'button';
    toast.className = 'pf-mobile-notification-toast';
    toast.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(bodyText || '')}</span>
    `;
    toast.addEventListener('click', function () {
      if (url) window.location.href = url;
    });
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });
    window.setTimeout(function () {
      toast.classList.remove('visible');
      window.setTimeout(function () {
        toast.remove();
      }, 250);
    }, 5200);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char];
    });
  }

  function showNativeNotification(event) {
    if (!canUseNativeNotifications() || Notification.permission !== 'granted') {
      showToast(event.title, event.body, event.url);
      return;
    }

    try {
      const notification = new Notification(event.title, {
        body: event.body,
        icon: '/static/images/Printfree_logo.png',
        badge: '/static/images/Printfree_logo.png',
        tag: event.id,
        renotify: event.priority === 'high',
        data: { url: event.url || '/' }
      });

      notification.onclick = function () {
        window.focus();
        if (event.url) window.location.href = event.url;
        notification.close();
      };
    } catch (error) {
      showToast(event.title, event.body, event.url);
    }
  }

  function showSummary(events) {
    if (events.length === 1) {
      showNativeNotification(events[0]);
      return;
    }

    const highPriority = events.find(function (event) {
      return event.priority === 'high';
    });
    const summary = highPriority || events[0];
    showNativeNotification({
      id: `summary-${Date.now()}`,
      title: role === 'admin' ? `${events.length} items need attention` : `${events.length} account updates`,
      body: summary.body,
      url: summary.url,
      priority: summary.priority
    });
  }

  async function pollNotificationFeed() {
    try {
      const response = await fetch('/api/mobile-notification-feed', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const data = await response.json();
      if (!data.success || !Array.isArray(data.events)) return;

      const seenIds = loadSeenIds();
      const unseenEvents = data.events.filter(function (event) {
        return event && event.id && !seenIds.has(event.id);
      });

      if (unseenEvents.length > 0) {
        showSummary(unseenEvents.slice(0, 4));
        unseenEvents.forEach(function (event) {
          seenIds.add(event.id);
        });
        saveSeenIds(seenIds);
      }

      scheduleNextPoll(data.poll_interval_ms);
    } catch (error) {
      scheduleNextPoll(role === 'admin' ? 15000 : 30000);
    }
  }

  function scheduleNextPoll(delay) {
    window.clearTimeout(pollingTimer);
    pollingTimer = window.setTimeout(pollNotificationFeed, Number(delay) || 30000);
  }

  async function requestNotificationPermission() {
    removeEnableButton();

    if (!canUseNativeNotifications()) {
      showToast('Mobile alerts enabled', 'This browser will show in-page alerts while the site is open.', window.location.pathname);
      pollNotificationFeed();
      return;
    }

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        showToast('Mobile alerts enabled', 'This browser will show in-page alerts while the site is open.', window.location.pathname);
      }
    }

    if (Notification.permission === 'granted') {
      showNativeNotification({
        id: 'notifications-enabled',
        title: 'Mobile alerts enabled',
        body: role === 'admin' ? 'You will be notified about approvals and support items.' : 'You will be notified about account and payment updates.',
        url: window.location.pathname,
        priority: 'normal'
      });
    } else {
      showToast('Mobile alerts enabled', 'Browser notifications are blocked, so alerts will show inside the site.', window.location.pathname);
    }

    pollNotificationFeed();
  }

  function createEnableButton() {
    if (enableButton || notificationPermission() === 'granted') return;

    enableButton = document.createElement('button');
    enableButton.type = 'button';
    enableButton.className = 'pf-mobile-enable-notifications';
    enableButton.textContent = role === 'admin' ? 'Enable approval alerts' : 'Enable account alerts';
    enableButton.addEventListener('click', requestNotificationPermission);
    document.body.appendChild(enableButton);
  }

  function removeEnableButton() {
    if (enableButton) {
      enableButton.remove();
      enableButton = null;
    }
  }

  function injectStyles() {
    if (document.getElementById('pf-mobile-notification-styles')) return;

    const style = document.createElement('style');
    style.id = 'pf-mobile-notification-styles';
    style.textContent = `
      .pf-mobile-enable-notifications {
        position: fixed;
        right: 14px;
        bottom: 18px;
        z-index: 9998;
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: #1a1510;
        color: #fff;
        font: 800 12px/1.1 'Inter', sans-serif;
        box-shadow: 0 8px 24px rgba(26,21,16,.22);
      }
      .pf-mobile-notification-toast {
        position: fixed;
        left: 14px;
        right: 14px;
        bottom: 18px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-align: left;
        border: 1px solid rgba(26,21,16,.12);
        border-radius: 12px;
        padding: 12px 14px;
        background: #fffdf7;
        color: #1a1510;
        box-shadow: 0 10px 30px rgba(26,21,16,.18);
        transform: translateY(120%);
        transition: transform .24s ease;
      }
      .pf-mobile-notification-toast.visible { transform: translateY(0); }
      .pf-mobile-notification-toast strong {
        font: 800 13px/1.2 'Inter', sans-serif;
      }
      .pf-mobile-notification-toast span {
        font: 500 12px/1.35 'Inter', sans-serif;
        opacity: .72;
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();

  if (notificationPermission() === 'granted') {
    pollNotificationFeed();
  } else {
    createEnableButton();
    pollNotificationFeed();
  }
}
