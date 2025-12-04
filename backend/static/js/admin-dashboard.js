document.addEventListener('DOMContentLoaded', function() {
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
