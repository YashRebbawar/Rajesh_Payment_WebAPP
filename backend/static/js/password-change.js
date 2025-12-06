var currentAccountId = null;

function closePasswordModal() {
    document.getElementById('password-modal').style.display = 'none';
    currentAccountId = null;
}

function submitPasswordChange() {
    var newPassword = document.getElementById('new-password').value.trim();
    var confirmPassword = document.getElementById('confirm-password').value.trim();
    var errorDiv = document.getElementById('password-error');
    
    if (!newPassword) {
        errorDiv.textContent = 'Password cannot be empty';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    fetch('/api/account/change-trading-password/' + currentAccountId, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({new_password: newPassword})
    }).then(function(response) {
        return response.json();
    }).then(function(data) {
        if (data.success) {
            closePasswordModal();
            alert('Trading password changed successfully!');
            if (typeof loadNotifications === 'function') {
                loadNotifications();
            }
        } else {
            errorDiv.textContent = data.message || 'Error changing password';
            errorDiv.style.display = 'block';
        }
    }).catch(function(error) {
        console.error('Error:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.style.display = 'block';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('password-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closePasswordModal();
            }
        });
    }
});
