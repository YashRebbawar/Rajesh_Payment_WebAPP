function closeMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburger) hamburger.classList.remove('open');
    if (hamburgerMobile) hamburgerMobile.classList.remove('open');
    if (mobileNav) mobileNav.classList.remove('open');
}

// Pending Dropdown Functions
document.addEventListener('DOMContentLoaded', function() {
    const pendingToggle = document.getElementById('pending-toggle');
    const pendingDetails = document.getElementById('pending-details');
    const pendingDropdown = document.getElementById('pending-status-dropdown');
    
    if (pendingToggle && pendingDetails) {
        pendingToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            pendingDetails.classList.toggle('active');
            if (pendingDropdown) pendingDropdown.classList.toggle('active');
        });
    }
    
    document.addEventListener('click', function(e) {
        if (!document.querySelector('.pending-dropdown-wrapper')?.contains(e.target)) {
            if (pendingDropdown) pendingDropdown.classList.remove('active');
            if (pendingDetails) pendingDetails.classList.remove('active');
        }
    });

    // User Chat Functions
    const modal = document.getElementById('user-chat-modal');
    if (modal) {
        const closeBtn = modal.querySelector('.chat-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeUserChatModal();
            });
        }
        
        const input = document.getElementById('user-chat-input');
        const sendBtn = document.querySelector('.user-chat-send-btn');
        
        if (input && sendBtn) {
            sendBtn.addEventListener('click', sendUserChatMessage);
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendUserChatMessage();
                }
            });
        }
        
        const modalContent = modal.querySelector('.chat-modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeUserChatModal();
            }
        });
    }

    // Support Widget
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

    // Mobile navigation
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', function() {
            const isOpen = hamburger.classList.toggle('open');
            if (hamburgerMobile) hamburgerMobile.classList.toggle('open', isOpen);
            mobileNav.classList.toggle('open', isOpen);
        });
    }

    if (hamburgerMobile && mobileNav) {
        hamburgerMobile.addEventListener('click', function() {
            const isOpen = hamburgerMobile.classList.toggle('open');
            if (hamburger) hamburger.classList.toggle('open', isOpen);
            mobileNav.classList.toggle('open', isOpen);
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeMobileNav();
    });

    document.addEventListener('click', function(e) {
        if (!mobileNav || !mobileNav.classList.contains('open')) return;
        if (e.target.closest('#mobileNav')) return;
        if (e.target.closest('#hamburger') || e.target.closest('#hamburger-mobile')) return;
        closeMobileNav();
    });

    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl) {
        const userCreatedAt = document.querySelector('[data-user-created-at]')?.getAttribute('data-user-created-at');
        if (userCreatedAt) {
            memberSinceEl.textContent = formatMemberSince(userCreatedAt);
        }
    }

    const bellToggle = document.getElementById('bell-toggle');
    const notificationDropdown = document.getElementById('notification-dropdown');
    
    if (bellToggle && notificationDropdown) {
        bellToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            notificationDropdown.classList.toggle('active');
            if (notificationDropdown.classList.contains('active')) {
                loadNotifications();
            }
        });
    }

    document.addEventListener('click', function(e) {
        const profileWrapper = document.querySelector('.user-profile-wrapper');
        const bellWrapper = document.querySelector('.notification-bell-wrapper');
        
        if (profileWrapper && !profileWrapper.contains(e.target)) {
            profileDropdown?.classList.remove('active');
        }
        
        if (bellWrapper && !bellWrapper.contains(e.target)) {
            notificationDropdown?.classList.remove('active');
        }
    });
    
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllNotifications);
    }

    const accountsList = document.querySelector('.accounts-list');
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            if (accountsList) {
                accountsList.className = view === 'grid' ? 'accounts-grid' : 'accounts-list';
            }
        });
    });

    document.querySelectorAll('.deposit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const accountId = this.getAttribute('data-account-id');
            window.location.href = '/payment/' + accountId;
        });
    });



    const sortDropdown = document.querySelector('.sort-dropdown');
    if (sortDropdown) {
        sortDropdown.addEventListener('change', function() {
            const accountsContainer = document.querySelector('.accounts-list') || document.querySelector('.accounts-grid');
            if (!accountsContainer) return;
            
            const cards = Array.from(accountsContainer.querySelectorAll('.account-card'));
            const sortValue = this.value;
            
            cards.sort((a, b) => {
                if (sortValue === 'Oldest') {
                    return 0;
                } else if (sortValue === 'Balance (High to Low)') {
                    const balanceA = parseFloat(a.querySelector('.balance-amount').textContent);
                    const balanceB = parseFloat(b.querySelector('.balance-amount').textContent);
                    return balanceB - balanceA;
                } else if (sortValue === 'Balance (Low to High)') {
                    const balanceA = parseFloat(a.querySelector('.balance-amount').textContent);
                    const balanceB = parseFloat(b.querySelector('.balance-amount').textContent);
                    return balanceA - balanceB;
                }
                return 0;
            });
            
            cards.forEach(card => accountsContainer.appendChild(card));
        });
    }
});

function editName() {
    document.getElementById('name-display').style.display = 'none';
    document.getElementById('name-edit').style.display = 'flex';
    document.getElementById('name-input').focus();
}

function cancelEdit() {
    document.getElementById('name-display').style.display = 'flex';
    document.getElementById('name-edit').style.display = 'none';
}

async function saveName() {
    const newName = document.getElementById('name-input').value.trim();
    if (!newName) return;
    
    try {
        const response = await fetch('/api/update-name', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName})
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('profile-name-text').textContent = newName;
            document.querySelector('.profile-card-avatar').textContent = newName[0].toUpperCase();
            cancelEdit();
        }
    } catch (error) {
        console.error('Error updating name:', error);
    }
}

function getDismissedNotifications() {
    const dismissed = localStorage.getItem('dismissedNotifications');
    return dismissed ? JSON.parse(dismissed) : [];
}

function saveDismissedNotifications(ids) {
    localStorage.setItem('dismissedNotifications', JSON.stringify(ids));
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/user/notifications');
        const data = await response.json();
        
        if (data.success) {
            const dismissedIds = getDismissedNotifications();
            const visibleNotifications = data.notifications.filter(n => !dismissedIds.includes(n._id));
            
            const notificationList = document.getElementById('notification-list');
            const badge = document.getElementById('notification-badge');
            const clearAllBtn = document.getElementById('clear-all-btn');
            
            if (visibleNotifications.length === 0) {
                notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
                badge.style.display = 'none';
                clearAllBtn.style.display = 'none';
            } else {
                badge.style.display = 'flex';
                badge.textContent = visibleNotifications.length;
                clearAllBtn.style.display = 'block';
                
                notificationList.innerHTML = visibleNotifications.map(notif => {
                    if (notif.type === 'mt_credentials_updated') {
                        return `
                            <div class="notification-item mt-updated" data-id="${notif._id}">
                                <div class="notification-icon">&#127881;</div>
                                <div class="notification-content">
                                    <div class="notification-title">Great News!</div>
                                    <div class="notification-text">
                                        Your MT credentials for ${notif.account_nickname} are ready! Check your account details.
                                    </div>
                                </div>
                                <button class="notification-close" onclick="clearNotification('${notif._id}', event)">&times;</button>
                            </div>
                        `;
                    } else {
                        const isApproved = notif.status === 'completed';
                        const statusClass = isApproved ? 'approved' : 'rejected';
                        const paymentType = notif.payment_type || 'deposit';
                        const typeLabel = paymentType === 'withdrawal' ? 'Withdrawal' : 'Deposit';
                        const statusText = isApproved ? 'Successful' : 'Failed';
                        const titleText = `${typeLabel} ${statusText}`;
                        const icon = isApproved ? '&#10003;' : '&#10005;';
                        
                        return `
                            <div class="notification-item ${statusClass}" data-id="${notif._id}">
                                <div class="notification-icon">${icon}</div>
                                <div class="notification-content">
                                    <div class="notification-title">${titleText}</div>
                                    <div class="notification-text">
                                        ${notif.account_nickname}: ${notif.amount} ${notif.currency}
                                    </div>
                                </div>
                                <button class="notification-close" onclick="clearNotification('${notif._id}', event)">&times;</button>
                            </div>
                        `;
                    }
                }).join('');
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function clearNotification(notificationId, event) {
    event.stopPropagation();
    const dismissedIds = getDismissedNotifications();
    dismissedIds.push(notificationId);
    saveDismissedNotifications(dismissedIds);
    loadNotifications();
}

function clearAllNotifications() {
    const notificationItems = document.querySelectorAll('.notification-item');
    const allIds = Array.from(notificationItems).map(item => item.dataset.id);
    saveDismissedNotifications(getDismissedNotifications().concat(allIds));
    loadNotifications();
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 0) return 'Just now';
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// User Chat Functions
function openUserChatModal() {
    const modal = document.getElementById('user-chat-modal');
    if (modal) {
        modal.classList.add('active');
        loadUserChatMessages();
    }
}

function closeUserChatModal() {
    const modal = document.getElementById('user-chat-modal');
    const widget = document.getElementById('support-widget');
    if (modal) {
        modal.classList.remove('active');
    }
    if (widget) {
        widget.style.display = 'block';
    }
}

function loadUserChatMessages() {
    fetch('/api/chat/user-messages')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                displayUserMessages(data.messages);
            } else {
                console.error('Failed to load messages:', data.message);
            }
        })
        .catch(err => console.error('Error loading messages:', err));
}

function displayUserMessages(messages) {
    const messagesContainer = document.getElementById('user-chat-messages');
    if (!messagesContainer) return;
    
    if (!Array.isArray(messages)) {
        console.error('Invalid messages format');
        messagesContainer.innerHTML = `
        <div class="chat-empty">
            <div class="welcome-content">
                    <div class="welcome-emoji">&#9888;&#65039;</div>
                <h3>Oops!</h3>
                <p>Error loading messages. Please try again.</p>
            </div>
        </div>
    `;
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="chat-empty">
                <div class="welcome-content">
                    <div class="welcome-emoji">&#128587;</div>
                    <h3>Hello! &#128075;</h3>
                    <p>Send us a message and we'll get back to you shortly</p>
                </div>
            </div>
        `;
        return;
    }
    
    const userId = document.body.dataset.userId;
    messages.forEach(msg => {
        try {
            if (!msg.sender_id || !msg.message || !msg.created_at) {
                console.warn('Invalid message object:', msg);
                return;
            }
            const isOwn = msg.sender_id === userId;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isOwn ? 'sent' : 'received'}`;
            
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `message-bubble ${isOwn ? 'sent' : 'received'}`;
            bubbleDiv.textContent = msg.message;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeDiv.textContent = time;
            
            const wrapper = document.createElement('div');
            wrapper.appendChild(bubbleDiv);
            wrapper.appendChild(timeDiv);
            messageDiv.appendChild(wrapper);
            
            messagesContainer.appendChild(messageDiv);
        } catch (err) {
            console.error('Error rendering message:', err, msg);
        }
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendUserChatMessage() {
    const input = document.getElementById('user-chat-input');
    const message = input.value.trim();
    
    if (!message) {
        console.warn('Empty message');
        return;
    }
    
    const btn = document.querySelector('.user-chat-send-btn');
    if (!btn) {
        console.error('Send button not found');
        return;
    }
    
    btn.disabled = true;
    
    fetch('/api/chat/user-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            input.value = '';
            loadUserChatMessages();
        } else {
            console.error('Send failed:', data.message);
            alert('Failed to send message: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        console.error('Error sending message:', err);
        alert('Error sending message: ' + err.message);
    })
    .finally(() => {
        btn.disabled = false;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Support Widget Functions
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

// Load notifications immediately
loadNotifications();

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 1000);

function formatMemberSince(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
