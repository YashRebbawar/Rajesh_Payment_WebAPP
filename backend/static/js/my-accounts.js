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

document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

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

    const pendingToggle = document.getElementById('pending-toggle');
    const pendingDetails = document.getElementById('pending-details');
    if (pendingToggle && pendingDetails) {
        pendingToggle.addEventListener('click', function() {
            pendingDetails.classList.toggle('active');
            this.classList.toggle('active');
        });
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

    document.querySelectorAll('.withdraw-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            alert('Withdraw functionality coming soon!');
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
            document.querySelector('.profile-icon').textContent = newName[0].toUpperCase();
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
                                <div class="notification-icon">🎉</div>
                                <div class="notification-content">
                                    <div class="notification-title">Great News!</div>
                                    <div class="notification-text">
                                        Your MT credentials for ${notif.account_nickname} are ready! Check your account details.
                                    </div>
                                    <div class="notification-time">${formatTime(notif.created_at)}</div>
                                </div>
                                <button class="notification-close" onclick="clearNotification('${notif._id}', event)">✕</button>
                            </div>
                        `;
                    } else {
                        const isApproved = notif.status === 'approved';
                        const statusClass = isApproved ? 'approved' : 'rejected';
                        const statusText = isApproved ? 'Approved' : 'Rejected';
                        const icon = isApproved ? '✓' : '✕';
                        
                        return `
                            <div class="notification-item ${statusClass}" data-id="${notif._id}">
                                <div class="notification-icon">${icon}</div>
                                <div class="notification-content">
                                    <div class="notification-title">Account ${statusText}</div>
                                    <div class="notification-text">
                                        ${notif.account_nickname}: ${notif.amount} ${notif.currency}
                                    </div>
                                    <div class="notification-time">${formatTime(notif.created_at)}</div>
                                </div>
                                <button class="notification-close" onclick="clearNotification('${notif._id}', event)">✕</button>
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
