let statusCheckInterval;

function startWithdrawalStatusCheck(withdrawalId) {
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/withdrawal/status/${withdrawalId}`);
            const data = await response.json();
            
            if (data.success) {
                if (data.status === 'approved') {
                    clearInterval(statusCheckInterval);
                    showWithdrawalApprovedNotification(data);
                }
            }
        } catch (error) {
            console.error('Error checking withdrawal status:', error);
        }
    }, 5000);
}

function showWithdrawalApprovedNotification(data) {
    const notification = document.createElement('div');
    notification.className = 'withdrawal-approved-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">✓</div>
            <div class="notification-text">
                <strong>Withdrawal Approved!</strong>
                <p>${data.amount} ${data.currency} has been successfully withdrawn.</p>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
        location.reload();
    }, 3000);
}
