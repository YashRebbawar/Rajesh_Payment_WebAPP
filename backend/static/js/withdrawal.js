document.addEventListener('DOMContentLoaded', () => {
    const amountInput = document.getElementById('amount');
    const upiIdInput = document.getElementById('upi-id');
    const continueButton = document.getElementById('continue-button');
    const withdrawalValue = document.getElementById('withdrawal-value');
    const confirmationModal = document.getElementById('confirmation-modal');
    const successModal = document.getElementById('success-modal');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const confirmationClose = document.querySelector('.confirmation-close');

    let accountBalance = parseFloat(continueButton.dataset.accountBalance);
    if (isNaN(accountBalance) || accountBalance === 0) {
        accountBalance = 999999;
    }
    
    const currency = continueButton.dataset.currency;
    const accountId = continueButton.dataset.accountId;

    function validateUpiId(upi) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi);
    }

    function updateButtonState() {
        const amount = parseFloat(amountInput.value) || 0;
        const upiValid = validateUpiId(upiIdInput.value.trim());
        
        if (amount > 0 && upiValid) {
            continueButton.classList.add('active');
        } else {
            continueButton.classList.remove('active');
        }
    }

    amountInput.addEventListener('input', () => {
        const amount = parseFloat(amountInput.value) || 0;
        withdrawalValue.textContent = amount.toFixed(2);
        
        document.getElementById('tooltip-amount').textContent = amount.toFixed(2);
        document.getElementById('tooltip-fee').textContent = '0.00';
        document.getElementById('tooltip-total').textContent = amount.toFixed(2);
        
        updateButtonState();
    });

    upiIdInput.addEventListener('input', updateButtonState);

    continueButton.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value) || 0;
        const upiId = upiIdInput.value.trim();
        
        if (amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        if (!validateUpiId(upiId)) {
            alert('Please enter a valid UPI ID (e.g., example@upi)');
            return;
        }
        
        document.getElementById('confirm-amount').textContent = amount.toFixed(2);
        document.getElementById('confirm-currency').textContent = currency;
        confirmationModal.style.display = 'block';
    });

    confirmationClose.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
    });

    confirmBtn.addEventListener('click', async () => {
        const amount = parseFloat(amountInput.value);
        const upiId = upiIdInput.value.trim();
        
        try {
            const response = await fetch('/api/withdrawal/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    account_id: accountId,
                    amount: amount,
                    currency: currency,
                    upi_id: upiId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                confirmationModal.style.display = 'none';
                successModal.style.display = 'block';
                startWithdrawalStatusCheck(data.withdrawal_id);
            } else {
                alert(data.message || 'Withdrawal failed');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred. Please try again.');
        }
    });

    function startWithdrawalStatusCheck(withdrawalId) {
        const statusCheckInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/withdrawal/status/${withdrawalId}`);
                const data = await response.json();
                
                if (data.success && data.status === 'approved') {
                    clearInterval(statusCheckInterval);
                    setTimeout(() => {
                        window.location.href = '/my-accounts';
                    }, 2000);
                }
            } catch (error) {
                console.error('Error checking withdrawal status:', error);
            }
        }, 5000);
    }

    window.addEventListener('click', (event) => {
        if (event.target === confirmationModal) {
            confirmationModal.style.display = 'none';
        }
        if (event.target === successModal) {
            confirmationModal.style.display = 'none';
        }
    });

    updateButtonState();
});
