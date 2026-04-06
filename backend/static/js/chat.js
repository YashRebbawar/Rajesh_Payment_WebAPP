/* ═══════════════════════════════════════════════════════
   chat.js  –  PrintFree themed · all original logic kept
═══════════════════════════════════════════════════════ */

let currentChatUserId = null;
let currentUserId     = null;
let unreadMessages    = {};
let chatPollIntervalId = null;
let isSendingChatMessage = false;

function isAdminPinUnlocked() {
    return !window.adminPinLock || window.adminPinLock.isUnlocked();
}

/* ══ OPEN / CLOSE ══ */
function openChatModal(userId, userName) {
    if (!isAdminPinUnlocked()) return;
    currentChatUserId = userId;
    const modal = document.getElementById('chat-modal');
    if (!modal) { console.error('Chat modal not found'); return; }

    /* Update header title */
    const header = modal.querySelector('.chat-header h3');
    if (header) header.textContent = userName || 'Support Chat';

    /* Update eyebrow to show the user name context */
    const eyebrow = modal.querySelector('.chat-header-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Live chat';

    modal.classList.add('active');

    /* Clear badge for this user */
    unreadMessages[userId] = 0;
    removeChatBadge(userId);

    loadChatMessages();
}

function closeChatModal() {
    const modal = document.getElementById('chat-modal');
    if (modal) modal.classList.remove('active');
    currentChatUserId = null;
}

/* ══ LOAD MESSAGES ══ */
function loadChatMessages() {
    if (!currentChatUserId || !isAdminPinUnlocked()) return;

    fetch(`/api/chat/messages/${currentChatUserId}`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                displayMessages(data.messages);
            } else {
                console.error('Failed to load messages:', data.message);
            }
        })
        .catch(err => console.error('Error loading messages:', err));
}

/* ══ DISPLAY MESSAGES ══ */
function displayMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (!Array.isArray(messages)) {
        console.error('Invalid messages format');
        container.innerHTML = '<div class="chat-empty"><p>Error loading messages</p></div>';
        return;
    }

    container.innerHTML = '';

    if (messages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <div class="welcome-content">
                    <div class="welcome-emoji">&#128075;</div>
                    <h3>Start the conversation</h3>
                    <p>Send a message to connect with this user</p>
                </div>
            </div>`;
        return;
    }

    let lastDate = null;

    messages.forEach(msg => {
        try {
            if (!msg.sender_id || !msg.message || !msg.created_at) {
                console.warn('Invalid message object:', msg);
                return;
            }

            /* ── Date divider ── */
            const msgDate = new Date(msg.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
            if (msgDate !== lastDate) {
                const divider = document.createElement('div');
                divider.className = 'chat-date-divider';
                divider.innerHTML = `<span>${msgDate}</span>`;
                container.appendChild(divider);
                lastDate = msgDate;
            }

            const isOwn = msg.sender_id === currentUserId;
            const time  = new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit'
            });

            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isOwn ? 'sent' : 'received'}`;
            messageDiv.innerHTML = `
                <div>
                    <div class="message-bubble ${isOwn ? 'sent' : 'received'}">${escapeHtml(msg.message)}</div>
                    <div class="message-time">${time}</div>
                </div>`;
            container.appendChild(messageDiv);

        } catch (err) {
            console.error('Error rendering message:', err, msg);
        }
    });

    container.scrollTop = container.scrollHeight;
}

/* ══ SEND MESSAGE ══ */
function sendChatMessage() {
    if (!isAdminPinUnlocked()) return;
    const input = document.getElementById('chat-input');
    const message = input?.value.trim();

    if (!message)           { console.warn('Empty message'); return; }
    if (!currentChatUserId) { console.error('No chat user selected'); return; }
    if (isSendingChatMessage) return;

    const btn = document.querySelector('.chat-send-btn');
    if (!btn) { console.error('Send button not found'); return; }

    isSendingChatMessage = true;
    btn.disabled = true;

    fetch('/api/chat/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: currentChatUserId, message })
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            input.value = '';
            input.style.height = '';      // reset textarea height
            loadChatMessages();
        } else {
            console.error('Send failed:', data.message);
            showChatToast('Failed to send: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        console.error('Error sending message:', err);
        showChatToast('Network error. Please try again.');
    })
    .finally(() => {
        isSendingChatMessage = false;
        btn.disabled = false;
        input.focus();
    });
}

/* ══ BADGE HELPERS (original) ══ */
function showChatBadge(userId) {
    const buttons = document.querySelectorAll('.chat-icon-btn');
    buttons.forEach(btn => {
        const attr = btn.getAttribute('onclick');
        if (attr && attr.includes(userId)) {
            let badge = btn.querySelector('.chat-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                badge.textContent = '1';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            } else {
                badge.textContent = (parseInt(badge.textContent) || 0) + 1;
            }
        }
    });
}

function removeChatBadge(userId) {
    const buttons = document.querySelectorAll('.chat-icon-btn');
    buttons.forEach(btn => {
        const attr = btn.getAttribute('onclick');
        if (attr && attr.includes(userId)) {
            btn.querySelector('.chat-badge')?.remove();
        }
    });
}

/* ══ POLL NEW MESSAGES (original) ══ */
function pollNewMessages() {
    if (currentChatUserId || !isAdminPinUnlocked()) return;   // don't poll if modal open

    fetch('/api/chat/unread-count')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.unread_users) {
                data.unread_users.forEach(userId => showChatBadge(userId));
            }
        })
        .catch(err => console.error('Error polling messages:', err));
}

/* ══ ESCAPE HTML ══ */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* ══ THEMED TOAST  (replaces alert) ══ */
function showChatToast(msg) {
    let toast = document.getElementById('pf-chat-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pf-chat-toast';
        Object.assign(toast.style, {
            position:     'fixed',
            bottom:       '100px',
            right:        '28px',
            zIndex:       '9999',
            padding:      '11px 18px',
            borderRadius: '100px',
            fontFamily:   '"Cabinet Grotesk", sans-serif',
            fontSize:     '12px',
            fontWeight:   '700',
            background:   '#1a1510',
            color:        '#f7f6f2',
            boxShadow:    '0 8px 28px rgba(26,21,16,0.20)',
            pointerEvents:'none',
            transform:    'translateY(20px)',
            opacity:      '0',
            transition:   'all 0.35s cubic-bezier(0.22,1,0.36,1)',
        });
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity   = '1';
    }));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.transform = 'translateY(20px)';
        toast.style.opacity   = '0';
    }, 4000);
}

/* ══ DOM READY ══ */
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('chat-modal');
    if (!modal) return;

    /* Close button */
    modal.querySelector('.chat-close')?.addEventListener('click', closeChatModal);

    /* Outside click closes */
    modal.addEventListener('click', e => {
        if (e.target === modal) closeChatModal();
    });

    /* Stop clicks inside panel from bubbling to backdrop */
    modal.querySelector('.chat-modal-content')?.addEventListener('click', e => e.stopPropagation());

    /* Send button + Enter key */
    const input   = document.getElementById('chat-input');
    const sendBtn = document.querySelector('.chat-send-btn');

    if (input && sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);

        input.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });

        /* Auto-grow textarea */
        input.addEventListener('input', function () {
            this.style.height = '';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
    }

    /* Poll for new messages every 5 s (original) */
    if (isAdminPinUnlocked()) {
        chatPollIntervalId = setInterval(pollNewMessages, 5000);
    }

    document.addEventListener('admin-pin:locked', () => {
        if (chatPollIntervalId) {
            clearInterval(chatPollIntervalId);
            chatPollIntervalId = null;
        }
        closeChatModal();
    });

    document.addEventListener('admin-pin:unlocked', () => {
        if (!chatPollIntervalId) {
            chatPollIntervalId = setInterval(pollNewMessages, 5000);
        }
    });
});
