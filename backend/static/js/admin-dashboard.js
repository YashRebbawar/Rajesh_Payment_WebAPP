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

async function rejectPayment(paymentId) {
    if (!confirm('Reject this payment? This action cannot be undone.')) return;
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    try {
        const response = await fetch(`/api/admin/reject-payment/${paymentId}`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert('Payment rejected successfully!');
            location.reload();
        } else {
            alert('Error: ' + data.message);
            btn.disabled = false;
            btn.textContent = 'Reject';
        }
    } catch (error) {
        console.error('Error rejecting payment:', error);
        alert('Failed to reject payment');
        btn.disabled = false;
        btn.textContent = 'Reject';
    }
}

async function approvePayment(paymentId) {
    if (!confirm('Approve this payment and credit the user account?')) return;
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Processing...';
    
    try {
        const response = await fetch(`/api/admin/approve-payment/${paymentId}`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.success) {
            alert('Payment approved successfully!');
            location.reload();
        } else {
            alert('Error: ' + data.message);
            btn.disabled = false;
            btn.textContent = 'Approve';
        }
    } catch (error) {
        console.error('Error approving payment:', error);
        alert('Failed to approve payment');
        btn.disabled = false;
        btn.textContent = 'Approve';
    }
}

setInterval(async () => {
    try {
        const response = await fetch('/api/admin/notifications');
        const data = await response.json();
        const currentCount = parseInt(document.querySelector('.notification-badge')?.textContent || '0');
        if (data.success && data.notifications.length > currentCount) {
            location.reload();
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
    }
}, 10000);
