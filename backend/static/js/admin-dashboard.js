function updatePaymentTimes() {
    // Time display removed from notifications
}

let currentEditAccountId = null;

function openEditModal(accountId, mtLogin, mtServer) {
    currentEditAccountId = accountId;
    document.getElementById('mt-login').value = mtLogin;
    document.getElementById('mt-server').value = mtServer;
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditAccountId = null;
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

function closeBalanceModal() {
    document.getElementById('balance-modal').style.display = 'none';
    currentBalancePaymentId = null;
    currentBalanceAccountId = null;
}

async function submitBalanceForm(event) {
    event.preventDefault();
    if (!currentBalancePaymentId) return;
    
    const balance = parseFloat(document.getElementById('balance-input').value);
    
    try {
        const paymentCard = Array.from(document.querySelectorAll('.pending-payment-card')).find(card => {
            const approveBtn = card.querySelector('.approve-btn');
            return approveBtn && approveBtn.getAttribute('onclick').includes(currentBalancePaymentId);
        });
        
        if (!paymentCard) {
            showErrorMessage('Payment card not found');
            return;
        }
        
        const accountId = paymentCard.dataset.accountId;
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
            showSuccessMessage('Account balance updated successfully!');
            closeBalanceModal();
            setTimeout(() => location.reload(), 1500);
        } else {
            showErrorMessage('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error updating balance:', error);
        showErrorMessage('Failed to update balance');
    }
}

async function submitEditForm(event) {
    event.preventDefault();
    if (!currentEditAccountId) return;
    
    const mtLogin = document.getElementById('mt-login').value;
    const mtServer = document.getElementById('mt-server').value;
    
    try {
        const response = await fetch(`/api/admin/update-account-mt/${currentEditAccountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mt_login: mtLogin, mt_server: mtServer })
        });
        const data = await response.json();
        
        if (data.success) {
            // Hide the new badge for this user after MT update
            const accountCard = document.querySelector(`[data-account-id="${currentEditAccountId}"]`);
            if (accountCard) {
                const userCard = accountCard.closest('.admin-user-card');
                if (userCard) {
                    const userBadge = userCard.querySelector('.new-user-badge');
                    if (userBadge) {
                        userBadge.style.display = 'none';
                    }
                }
            }
            showSuccessMessage('MT details updated successfully!');
            closeEditModal();
            setTimeout(() => location.reload(), 1500);
        } else {
            showErrorMessage('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error updating MT details:', error);
        showErrorMessage('Failed to update MT details');
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

    // Edit button click handler
    document.querySelectorAll('.edit-account-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const accountId = this.getAttribute('data-account-id');
            const mtLogin = this.getAttribute('data-mt-login');
            const mtServer = this.getAttribute('data-mt-server');
            openEditModal(accountId, mtLogin, mtServer);
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
    const editModal = document.getElementById('edit-modal');
    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeEditModal();
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
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-message toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

async function quickMigrateToLatestAccount() {
    try {
        const response = await fetch('/api/admin/latest-new-account');
        const data = await response.json();
        
        if (data.success && data.account) {
            const accountId = data.account._id;
            const accountCard = document.querySelector(`[data-account-id="${accountId}"]`);
            
            if (accountCard) {
                accountCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                accountCard.classList.add('highlight-account');
                setTimeout(() => accountCard.classList.remove('highlight-account'), 3000);
            }
            showSuccessMessage('Migrated to latest account: ' + data.account.nickname);
        } else {
            showErrorMessage('No new accounts found');
        }
    } catch (error) {
        console.error('Error migrating to latest account:', error);
        showErrorMessage('Failed to migrate to latest account');
    }
}

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
