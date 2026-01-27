function updatePaymentTimes() {
    // Time display removed from notifications
}

let currentUnifiedEditAccountId = null;
let currentUnifiedEditAccountName = null;

// Load commission stats
async function loadCommissionStats() {
    try {
        const response = await fetch('/api/admin/commission-stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('total-platform-fee').textContent = '₹' + data.platform_fee.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('total-deposits').textContent = '₹' + data.total_deposits.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('transaction-count').textContent = data.transaction_count;
            document.getElementById('pending-platform-fee').textContent = '₹' + data.pending_fee.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('pending-deposits').textContent = '₹' + data.pending_deposits.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    } catch (error) {
        console.error('Error loading commission stats:', error);
    }
}

// Load users with no account type
async function loadUsersNoAccountType() {
    try {
        const response = await fetch('/api/admin/users-no-account-type');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('no-account-type-count').textContent = data.count;
            if (data.count > 0) {
                const userList = data.users.map(u => u.email).join(', ');
                document.getElementById('no-account-type-list').textContent = userList.length > 50 ? userList.substring(0, 50) + '...' : userList;
            } else {
                document.getElementById('no-account-type-list').textContent = 'None';
            }
        }
    } catch (error) {
        console.error('Error loading users with no account type:', error);
    }
}

// Load commission stats on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCommissionStats();
    loadUsersNoAccountType();
});

// Refresh commission stats every 30 seconds
setInterval(() => {
    loadCommissionStats();
    loadUsersNoAccountType();
}, 30000);

function openUnifiedEditModal(accountId, mtLogin, mtServer, password, leverage, balance, nickname) {
    currentUnifiedEditAccountId = accountId;
    currentUnifiedEditAccountName = nickname || 'Account';
    document.getElementById('unified-mt-login').value = mtLogin;
    document.getElementById('unified-mt-server').value = mtServer;
    document.getElementById('unified-password').value = password;
    document.getElementById('unified-leverage').value = leverage;
    document.getElementById('unified-balance').value = balance;
    document.getElementById('unified-edit-modal').style.display = 'flex';
}

function closeUnifiedEditModal() {
    document.getElementById('unified-edit-modal').style.display = 'none';
    currentUnifiedEditAccountId = null;
    currentUnifiedEditAccountName = null;
}

async function submitUnifiedEditForm(event) {
    event.preventDefault();
    if (!currentUnifiedEditAccountId) {
        showErrorMessage('Account ID not set');
        return;
    }
    
    const mtLogin = document.getElementById('unified-mt-login').value;
    const mtServer = document.getElementById('unified-mt-server').value;
    const password = document.getElementById('unified-password').value;
    const leverage = document.getElementById('unified-leverage').value;
    const balance = parseFloat(document.getElementById('unified-balance').value);
    
    if (!mtLogin || !mtServer || !password || !leverage || isNaN(balance)) {
        showErrorMessage('Please fill in all fields');
        return;
    }
    
    const saveBtn = document.getElementById('unified-save-btn');
    const cancelBtn = document.getElementById('unified-cancel-btn');
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const updateMtResponse = await fetch(`/api/admin/update-account-mt/${currentUnifiedEditAccountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mt_login: mtLogin, mt_server: mtServer })
        });
        const mtData = await updateMtResponse.json();
        
        const updateDetailsResponse = await fetch(`/api/admin/update-account-details/${currentUnifiedEditAccountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password, leverage: leverage })
        });
        const detailsData = await updateDetailsResponse.json();
        
        const updateBalanceResponse = await fetch(`/api/admin/update-account-balance/${currentUnifiedEditAccountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: balance })
        });
        const balanceData = await updateBalanceResponse.json();
        
        if (mtData.success && detailsData.success && balanceData.success) {
            closeUnifiedEditModal();
            showSuccessMessage(`${currentUnifiedEditAccountName || 'Account'} updated successfully!`);
            setTimeout(() => location.reload(), 2000);
        } else {
            showErrorMessage('Error: ' + (mtData.message || detailsData.message || balanceData.message));
            saveBtn.disabled = false;
            cancelBtn.disabled = false;
            saveBtn.textContent = 'Save All Changes';
        }
    } catch (error) {
        console.error('Error updating account:', error);
        showErrorMessage('Failed to update account: ' + error.message);
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = 'Save All Changes';
    }
}

let currentBalancePaymentId = null;
let currentBalanceAccountId = null;

function openBalanceModal(paymentId) {
    currentBalancePaymentId = paymentId;
    const paymentCard = document.querySelector(`[data-payment-id="${paymentId}"]`);
    if (!paymentCard) {
        const card = Array.from(document.querySelectorAll('.pending-payment-card')).find(c => 
            c.querySelector('.approve-btn')?.onclick?.toString().includes(paymentId)
        );
        if (card) {
            const accountId = card.dataset.accountId;
            currentBalanceAccountId = accountId;
        }
    }
    document.getElementById('balance-input').value = '';
    document.getElementById('balance-modal').style.display = 'flex';
}

function openBalanceModalForAccount(accountId) {
    currentBalanceAccountId = accountId;
    currentBalancePaymentId = null;
    const accountCard = document.querySelector(`[data-account-id="${accountId}"]`);
    if (accountCard) {
        const currentBalance = accountCard.querySelector('.balance-amount')?.textContent || '0.00';
        document.getElementById('balance-input').value = currentBalance;
    } else {
        document.getElementById('balance-input').value = '';
    }
    document.getElementById('balance-modal').style.display = 'flex';
}

function closeBalanceModal() {
    document.getElementById('balance-modal').style.display = 'none';
    currentBalancePaymentId = null;
    currentBalanceAccountId = null;
}

async function submitBalanceForm(event) {
    event.preventDefault();
    const balance = parseFloat(document.getElementById('balance-input').value);
    
    if (isNaN(balance) || balance < 0) {
        showErrorMessage('Please enter a valid balance');
        return;
    }
    
    try {
        let accountId = currentBalanceAccountId;
        
        if (!accountId && currentBalancePaymentId) {
            const paymentCard = Array.from(document.querySelectorAll('.pending-payment-card')).find(card => {
                const approveBtn = card.querySelector('.approve-btn');
                return approveBtn && approveBtn.getAttribute('onclick').includes(currentBalancePaymentId);
            });
            
            if (!paymentCard) {
                showErrorMessage('Payment card not found');
                return;
            }
            
            accountId = paymentCard.dataset.accountId;
        }
        
        if (!accountId) {
            showErrorMessage('Account ID not found');
            return;
        }
        
        const response = await fetch(`/api/admin/update-account-balance/${accountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: balance })
        });
        const data = await response.json();
        
        if (data.success) {
            closeBalanceModal();
            showSuccessMessage('Account balance updated successfully!');
            setTimeout(() => location.reload(), 2000);
        } else {
            showErrorMessage('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error updating balance:', error);
        showErrorMessage('Failed to update balance');
    }
}

async function loadNewUserNotifications() {
    try {
        const response = await fetch('/api/admin/new-user-notifications');
        const data = await response.json();
        
        if (data.success && data.notifications.length > 0) {
            data.notifications.forEach(notif => {
                const userBadge = document.querySelector(`[data-user-id="${notif.user_id}"].new-user-badge`);
                if (userBadge) {
                    userBadge.style.display = 'inline-block';
                }
            });
        }
    } catch (error) {
        console.error('Error loading new user notifications:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    updatePaymentTimes();
    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        const wrapper = document.querySelector('.user-profile-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            profileDropdown?.classList.remove('active');
        }
    });

    const usersList = document.querySelector('.admin-users-list');
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            if (usersList) {
                usersList.className = view === 'grid' ? 'admin-users-grid' : 'admin-users-list';
            }
        });
    });

    // User card toggle
    document.querySelectorAll('.admin-user-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.delete-btn') || e.target.closest('.edit-account-btn') || e.target.closest('.chat-icon-btn')) {
                return;
            }
            const accountsSection = this.querySelector('.admin-accounts-section');
            if (accountsSection) {
                accountsSection.style.display = accountsSection.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Admin user search
    const adminSearchInput = document.getElementById('admin-user-search');
    if (adminSearchInput) {
        adminSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const userCards = document.querySelectorAll('.admin-user-card');
            
            userCards.forEach(card => {
                const userName = card.querySelector('.user-details h3')?.textContent.toLowerCase() || '';
                const userEmail = card.querySelector('.user-email')?.textContent.toLowerCase() || '';
                
                const matches = userName.includes(searchTerm) || userEmail.includes(searchTerm);
                card.style.display = matches ? 'block' : 'none';
            });
        });
    }

    // Payment filtering
    const searchInput = document.getElementById('payment-search');
    const currencyFilter = document.getElementById('currency-filter');
    
    function filterPayments() {
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const selectedCurrency = currencyFilter?.value || 'all';
        const paymentCards = document.querySelectorAll('.pending-payment-card');
        
        paymentCards.forEach(card => {
            const userEmail = card.dataset.userEmail.toLowerCase();
            const currency = card.dataset.currency;
            
            const matchesSearch = userEmail.includes(searchTerm);
            const matchesCurrency = selectedCurrency === 'all' || currency === selectedCurrency;
            
            if (matchesSearch && matchesCurrency) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }
    
    searchInput?.addEventListener('input', filterPayments);
    currencyFilter?.addEventListener('change', filterPayments);

    // Close edit modal on outside click
    const unifiedEditModal = document.getElementById('unified-edit-modal');
    if (unifiedEditModal) {
        unifiedEditModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeUnifiedEditModal();
            }
        });
    }
    
    // Load new user notifications
    loadNewUserNotifications();
});

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user and all their accounts?')) return;
    
    try {
        const response = await fetch(`/api/admin/delete-user/${userId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
    }
}

function viewScreenshot(screenshotBase64) {
    const modal = document.getElementById('screenshot-modal');
    const img = document.getElementById('screenshot-image');
    img.src = 'data:image/jpeg;base64,' + screenshotBase64;
    modal.style.display = 'block';
}

function closeScreenshotModal() {
    document.getElementById('screenshot-modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('screenshot-modal');
    if (event.target === modal) {
        closeScreenshotModal();
    }
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
        <div class="confirm-modal-content">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="confirm-modal-actions">
                <button class="confirm-cancel-btn" onclick="this.closest('.confirm-modal').remove()">Cancel</button>
                <button class="confirm-ok-btn">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.confirm-ok-btn').onclick = () => {
        modal.remove();
        onConfirm();
    };
}

async function rejectPayment(paymentId) {
    showConfirmModal(
        'Reject Payment',
        'Are you sure you want to reject this payment? This action cannot be undone.',
        async () => {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Processing...';
            
            try {
                const response = await fetch(`/api/admin/reject-payment/${paymentId}`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    showSuccessMessage('Payment rejected successfully!');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showErrorMessage('Error: ' + data.message);
                    btn.disabled = false;
                    btn.textContent = 'Reject';
                }
            } catch (error) {
                console.error('Error rejecting payment:', error);
                showErrorMessage('Failed to reject payment');
                btn.disabled = false;
                btn.textContent = 'Reject';
            }
        }
    );
}

async function approvePayment(paymentId) {
    showConfirmModal(
        'Approve Payment',
        'Are you sure you want to approve this payment and credit the user account?',
        async () => {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Processing...';
            
            try {
                const response = await fetch(`/api/admin/approve-payment/${paymentId}`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    showSuccessMessage('Payment approved successfully!');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showErrorMessage('Error: ' + data.message);
                    btn.disabled = false;
                    btn.textContent = 'Approve';
                }
            } catch (error) {
                console.error('Error approving payment:', error);
                showErrorMessage('Failed to approve payment');
                btn.disabled = false;
                btn.textContent = 'Approve';
            }
        }
    );
}

function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message toast-success';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:#4caf50;color:white;padding:16px 24px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-weight:500;font-size:14px;animation:slideIn 0.3s ease-out;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message toast-error';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;background:#f44336;color:white;padding:16px 24px;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-weight:500;font-size:14px;animation:slideIn 0.3s ease-out;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

let migrateDropdownOpen = false;

async function toggleMigrateDropdown() {
    const btn = document.querySelector('.quick-migrate-header-btn');
    let dropdown = document.getElementById('migrate-dropdown');
    
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'migrate-dropdown';
        dropdown.className = 'migrate-dropdown';
        dropdown.style.cssText = 'position:absolute;top:100%;right:0;background:white;border:1px solid #ddd;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);min-width:280px;max-height:400px;overflow-y:auto;z-index:1000;margin-top:8px;';
        btn.parentElement.style.position = 'relative';
        btn.parentElement.appendChild(dropdown);
    }
    
    if (migrateDropdownOpen) {
        dropdown.style.display = 'none';
        migrateDropdownOpen = false;
        return;
    }
    
    dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">Loading...</div>';
    dropdown.style.display = 'block';
    migrateDropdownOpen = true;
    
    try {
        const response = await fetch('/api/admin/chat-users-with-pending');
        const data = await response.json();
        
        if (data.success && data.users.length > 0) {
            dropdown.innerHTML = data.users.map(user => `
                <div class="migrate-user-item" onclick="selectMigrateUser('${user.user_id}', '${user.name.replace(/'/g, "\\'")}')"
                     style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
                    <div>
                        <div style="font-weight:500;color:#333;">${user.name}</div>
                        <div style="font-size:12px;color:#999;">${user.email}</div>
                    </div>
                    <div style="background:#ff9800;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:500;">${user.pending_count}</div>
                </div>
            `).join('');
            
            document.querySelectorAll('.migrate-user-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            });
        } else {
            dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#999;">No pending messages</div>';
        }
    } catch (error) {
        console.error('Error loading migrate users:', error);
        dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#f44336;">Error loading users</div>';
    }
}

function selectMigrateUser(userId, userName) {
    const dropdown = document.getElementById('migrate-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
        migrateDropdownOpen = false;
    }
    openChatModal(userId, userName);
    showSuccessMessage('Opened chat with: ' + userName);
}

document.addEventListener('click', (e) => {
    const btn = document.querySelector('.quick-migrate-header-btn');
    const dropdown = document.getElementById('migrate-dropdown');
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
        migrateDropdownOpen = false;
    }
});

setInterval(async () => {
    try {
        const response = await fetch('/api/admin/notifications');
        const data = await response.json();
        const currentCount = document.querySelectorAll('.pending-payment-card:not(.hidden)').length;
        if (data.success && data.notifications.length > currentCount) {
            location.reload();
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}, 15000);

setInterval(async () => {
    if (migrateDropdownOpen) {
        const dropdown = document.getElementById('migrate-dropdown');
        if (dropdown) {
            try {
                const response = await fetch('/api/admin/chat-users-with-pending');
                const data = await response.json();
                
                if (data.success && data.users.length > 0) {
                    dropdown.innerHTML = data.users.map(user => `
                        <div class="migrate-user-item" onclick="selectMigrateUser('${user.user_id}', '${user.name.replace(/'/g, "\\'")}')"
                             style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;">
                            <div>
                                <div style="font-weight:500;color:#333;">${user.name}</div>
                                <div style="font-size:12px;color:#999;">${user.email}</div>
                            </div>
                            <div style="background:#ff9800;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:500;">${user.pending_count}</div>
                        </div>
                    `).join('');
                    
                    document.querySelectorAll('.migrate-user-item').forEach(item => {
                        item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
                        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                    });
                }
            } catch (error) {
                console.error('Error refreshing migrate dropdown:', error);
            }
        }
    }
}, 5000);
const mobileAdminSearchInput = document.getElementById('mobile-admin-user-search');
if (mobileAdminSearchInput) {
    mobileAdminSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const userCards = document.querySelectorAll('.admin-user-card');
        
        userCards.forEach(card => {
            const userName = card.querySelector('.user-details h3')?.textContent.toLowerCase() || '';
            const userEmail = card.querySelector('.user-email')?.textContent.toLowerCase() || '';
            
            const matches = userName.includes(searchTerm) || userEmail.includes(searchTerm);
            card.style.display = matches ? 'block' : 'none';
        });
    });
}
