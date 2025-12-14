document.addEventListener('DOMContentLoaded', function() {
    const widget = document.getElementById('support-widget');
    
    if (!widget) {
        const supportWidget = document.createElement('div');
        supportWidget.id = 'support-widget';
        supportWidget.className = 'support-widget';
        supportWidget.innerHTML = `
            <div class="support-widget-container">
                <div class="support-widget-text">Chat Support</div>
                <button class="support-widget-icon-btn" onclick="openUserChatModalWithBadge()">
                    <img src="/static/images/support-icon.png" alt="Support" class="support-icon-img">
                    <span class="support-badge" style="display: none;"></span>
                </button>
            </div>
        `;
        document.body.appendChild(supportWidget);
    }
    
    pollUserUnreadMessages();
    setInterval(pollUserUnreadMessages, 3000);
});

function openUserChatModalWithBadge() {
    openUserChatModal();
    clearUserChatBadge();
}

function showUserChatBadge(count) {
    const btn = document.querySelector('.support-widget-icon-btn');
    if (btn) {
        let badge = btn.querySelector('.support-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'support-badge';
            btn.style.position = 'relative';
            btn.appendChild(badge);
        }
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

function clearUserChatBadge() {
    showUserChatBadge(0);
}

function pollUserUnreadMessages() {
    const modal = document.getElementById('user-chat-modal');
    if (modal && !modal.classList.contains('active')) {
        fetch('/api/chat/user-messages')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.messages)) {
                    const userId = document.body.dataset.userId;
                    const unreadCount = data.messages.filter(msg => 
                        msg.sender_id !== userId && !msg.read
                    ).length;
                    showUserChatBadge(unreadCount);
                }
            })
            .catch(err => console.error('Error polling user messages:', err));
    }
}
