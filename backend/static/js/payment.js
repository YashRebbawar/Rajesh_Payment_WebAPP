function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 1000);

document.addEventListener('DOMContentLoaded', function() {
    const amountInput = document.getElementById('amount');
    const payButton = document.getElementById('pay-button');
    const depositValueEl = document.getElementById('deposit-value');
    const accountCurrency = payButton.dataset.currency;
    const accountId = payButton.dataset.accountId;
    const accountType = payButton.dataset.accountType;
    
    // For USD accounts, use INR for deposit
    const depositCurrency = accountCurrency === 'USD' ? 'INR' : accountCurrency;

    const minAmount = accountType === 'standard' ? 1000 : 50000;
    const maxAmount = accountType === 'standard' ? 50000 : 100000;

    amountInput.addEventListener('input', function() {
        const value = parseFloat(this.value) || 0;
        const fee = value * 0.014;
        const total = value + fee;
        depositValueEl.textContent = total.toFixed(0);
        
        document.getElementById('tooltip-amount').textContent = value.toFixed(2);
        document.getElementById('tooltip-fee').textContent = fee.toFixed(2);
        document.getElementById('tooltip-total').textContent = total.toFixed(2);
        
        const isValid = value >= minAmount && value <= maxAmount;
        payButton.disabled = !isValid;
        if (isValid) {
            payButton.classList.add('active');
        } else {
            payButton.classList.remove('active');
        }
    });

    payButton.addEventListener('click', async function(e) {
        e.preventDefault();
        const amount = parseFloat(amountInput.value);
        
        if (!amount || amount < minAmount) {
            alert(`Please enter an amount of at least ${minAmount} ${depositCurrency}`);
            return;
        }

        showQRModal(amount, depositCurrency, accountId);
    });

    function showQRModal(amount, currency, accountId) {
        const modal = document.getElementById('qr-modal');
        const fee = amount * 0.014;
        const total = amount + fee;
        document.getElementById('qr-amount').textContent = total.toFixed(2);
        document.getElementById('qr-currency').textContent = currency;
        modal.style.display = 'block';
        initializePaymentData(accountId, amount, currency);
    }

    function generateReference() {
        return 'PAY' + Date.now().toString().slice(-8);
    }

    let currentPaymentId = null;
    let screenshotFile = null;
    let pendingPaymentData = null;

    function initializePaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('payment-ref').textContent = reference;
        pendingPaymentData = { accountId, amount, currency, reference };
    }

    document.getElementById('upload-screenshot-btn').addEventListener('click', function() {
        document.getElementById('screenshot-input').click();
    });

    document.getElementById('screenshot-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            
            screenshotFile = file;
            document.getElementById('filename-text').textContent = file.name;
            document.getElementById('screenshot-filename').style.display = 'flex';
            document.getElementById('upload-screenshot-btn').style.display = 'none';
            document.getElementById('confirm-payment-btn').disabled = false;
        }
    });

    document.getElementById('remove-screenshot-btn').addEventListener('click', function() {
        screenshotFile = null;
        document.getElementById('screenshot-input').value = '';
        document.getElementById('screenshot-filename').style.display = 'none';
        document.getElementById('upload-screenshot-btn').style.display = 'flex';
        document.getElementById('confirm-payment-btn').disabled = true;
    });

    document.getElementById('confirm-payment-btn').addEventListener('click', async function() {
        if (!screenshotFile || !pendingPaymentData) return;
        
        const btn = this;
        btn.style.display = 'none';
        document.getElementById('payment-status').style.display = 'flex';
        
        try {
            const initiateResponse = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    account_id: pendingPaymentData.accountId,
                    amount: pendingPaymentData.amount,
                    currency: depositCurrency,
                    reference: pendingPaymentData.reference
                })
            });
            
            const initiateData = await initiateResponse.json();
            if (!initiateData.success) {
                alert('Error creating payment. Please try again.');
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
                return;
            }
            
            currentPaymentId = initiateData.payment_id;
            
            const formData = new FormData();
            formData.append('screenshot', screenshotFile);
            
            const uploadResponse = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
                alert('Error uploading screenshot: ' + uploadData.message);
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
                return;
            }
            
            const response = await fetch(`/api/payment/simulate/${currentPaymentId}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('qr-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                alert('Error processing payment. Please contact support.');
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            alert('Error processing payment. Please contact support.');
            btn.style.display = 'block';
            document.getElementById('payment-status').style.display = 'none';
        }
    });

    document.querySelector('.qr-close').addEventListener('click', function() {
        document.getElementById('discard-modal').style.display = 'block';
    });

    window.addEventListener('click', function(event) {
        const modal = document.getElementById('qr-modal');
        if (event.target === modal) {
            document.getElementById('discard-modal').style.display = 'block';
        }
    });

    document.getElementById('discard-cancel-btn').addEventListener('click', function() {
        document.getElementById('discard-modal').style.display = 'none';
    });

    document.getElementById('discard-confirm-btn').addEventListener('click', function() {
        document.getElementById('discard-modal').style.display = 'none';
        document.getElementById('qr-modal').style.display = 'none';
        currentPaymentId = null;
        screenshotFile = null;
        pendingPaymentData = null;
        document.getElementById('screenshot-input').value = '';
        document.getElementById('screenshot-filename').style.display = 'none';
        document.getElementById('upload-screenshot-btn').style.display = 'flex';
        document.getElementById('confirm-payment-btn').disabled = true;
    });

    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileToggle) {
        profileToggle.addEventListener('click', function() {
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        const wrapper = document.querySelector('.user-profile-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            profileDropdown?.classList.remove('active');
        }
    });
});
