document.addEventListener('DOMContentLoaded', function() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    loadPasswordNotifications();
    setInterval(loadPasswordNotifications, 10000);
});

function switchTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadPasswordNotifications() {
    try {
        const response = await fetch('/api/admin/trading-password-notifications');
        const data = await response.json();
        
        if (data.success) {
            const list = document.getElementById('password-changes-list');
            const badge = document.getElementById('password-changes-badge');
            
            if (data.notifications.length === 0) {
                list.innerHTML = '<div class="no-notifications-message"><p>No password change notifications</p></div>';
                badge.style.display = 'none';
            } else {
                badge.style.display = 'flex';
                badge.textContent = data.notifications.length;
                
                list.innerHTML = data.notifications.map(notif => `
                    <div class="password-change-card" data-notification-id="${notif._id}">
                        <div class="password-change-info">
                            <div class="password-change-avatar">${notif.user_name[0].toUpperCase()}</div>
                            <div class="password-change-details">
                                <div class="password-change-user">${notif.user_name}</div>
                                <div class="password-change-account">Account: ${notif.account_nickname}</div>
                                <div style="font-size: 11px; color: #999; margin-top: 4px;">${notif.user_email}</div>
                            </div>
                        </div>
                        <div class="password-change-time">${formatTime(notif.created_at)}</div>
                        <div class="password-change-actions">
                            <button class="password-acknowledge-btn" onclick="acknowledgePasswordChange('${notif._id}')">Clear</button>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading password notifications:', error);
    }
}

async function acknowledgePasswordChange(notificationId) {
    try {
        const response = await fetch(`/api/admin/mark-password-notification-read/${notificationId}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        if (data.success) {
            loadPasswordNotifications();
        }
    } catch (error) {
        console.error('Error acknowledging notification:', error);
    }
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
