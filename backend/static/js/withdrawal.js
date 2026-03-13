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
    const paymentMethodBtns = document.querySelectorAll('.payment-method-btn');
    const upiFields = document.getElementById('upi-fields');
    const bankFields = document.getElementById('bank-fields');
    const accountHolderInput = document.getElementById('account-holder');
    const accountNumberInput = document.getElementById('account-number');
    const ifscCodeInput = document.getElementById('ifsc-code');

    let currentPaymentMethod = 'upi';
    let accountBalance = parseFloat(continueButton.dataset.accountBalance);
    if (isNaN(accountBalance) || accountBalance === 0) {
        accountBalance = 999999;
    }
    
    const currency = continueButton.dataset.currency;
    const accountId = continueButton.dataset.accountId;

    // Payment method switching
    paymentMethodBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            paymentMethodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPaymentMethod = btn.dataset.method;
            
            if (currentPaymentMethod === 'upi') {
                if (upiFields) upiFields.style.display = 'block';
                if (bankFields) bankFields.style.display = 'none';
            } else {
                if (upiFields) upiFields.style.display = 'none';
                if (bankFields) bankFields.style.display = 'block';
            }
            updateButtonState();
        });
    });

    function validateUpiId(upi) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi);
    }

    function validateBankDetails() {
        if (!accountHolderInput || !accountNumberInput || !ifscCodeInput) {
            return false;
        }
        const holder = accountHolderInput.value.trim();
        const account = accountNumberInput.value.trim();
        const ifsc = ifscCodeInput.value.trim();
        
        return holder.length > 0 && account.length >= 9 && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#c0392b' : '#2d7a4f'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 13px;
            font-weight: 600;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function updateButtonState() {
        const amount = parseFloat(amountInput.value) || 0;
        let isValid = false;
        
        if (currentPaymentMethod === 'upi') {
            const upiValid = validateUpiId(upiIdInput.value.trim());
            const inRange = amount >= 10 && amount <= 50;
            isValid = amount > 0 && upiValid && inRange;
        } else {
            const bankValid = validateBankDetails();
            isValid = amount > 0 && bankValid;
        }
        
        if (isValid) {
            continueButton.classList.add('active');
            continueButton.disabled = false;
        } else {
            continueButton.classList.remove('active');
            continueButton.disabled = true;
        }
    }

    amountInput.addEventListener('input', () => {
        const amount = parseFloat(amountInput.value) || 0;
        withdrawalValue.textContent = amount.toFixed(2);
        
        document.getElementById('tooltip-amount').textContent = amount.toFixed(2);
        document.getElementById('tooltip-fee').textContent = '0.00';
        document.getElementById('tooltip-total').textContent = amount.toFixed(2);
        
        if (currentPaymentMethod === 'upi' && amount > 0 && (amount < 10 || amount > 50)) {
            showNotification('Withdrawal amount must be between $10 and $50', 'error');
        }
        
        updateButtonState();
    });

    if (upiIdInput) upiIdInput.addEventListener('input', updateButtonState);
    if (accountHolderInput) accountHolderInput.addEventListener('input', updateButtonState);
    if (accountNumberInput) accountNumberInput.addEventListener('input', updateButtonState);
    if (ifscCodeInput) ifscCodeInput.addEventListener('input', updateButtonState);

    continueButton.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value) || 0;
        
        if (amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        
        if (currentPaymentMethod === 'upi') {
            if (amount < 10 || amount > 50) {
                alert('Withdrawal amount must be between $10 and $50');
                return;
            }
            const upiId = upiIdInput.value.trim();
            if (!validateUpiId(upiId)) {
                alert('Please enter a valid UPI ID (e.g., example@upi)');
                return;
            }
        } else {
            if (!validateBankDetails()) {
                alert('Please enter valid bank details');
                return;
            }
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
        
        let payload = {
            account_id: accountId,
            amount: amount,
            currency: currency,
            payment_method: currentPaymentMethod
        };
        
        if (currentPaymentMethod === 'upi') {
            payload.upi_id = upiIdInput.value.trim();
        } else {
            payload.account_holder = accountHolderInput.value.trim();
            payload.account_number = accountNumberInput.value.trim();
            payload.ifsc_code = ifscCodeInput.value.trim();
        }
        
        try {
            const response = await fetch('/api/withdrawal/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
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
