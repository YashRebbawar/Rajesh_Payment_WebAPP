function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 60000);

document.addEventListener('DOMContentLoaded', function() {
    const amountInput = document.getElementById('amount');
    const payButton = document.getElementById('pay-button');
    const quickAmountBtns = document.querySelectorAll('.quick-amount-btn');
    const accountCurrency = payButton.dataset.currency;
    const accountId = payButton.dataset.accountId;

    quickAmountBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            amountInput.value = this.dataset.amount;
        });
    });

    payButton.addEventListener('click', async function(e) {
        e.preventDefault();
        const amount = parseFloat(amountInput.value);
        const minAmount = accountCurrency === 'INR' ? 1 : 10;
        
        if (!amount || amount < minAmount) {
            alert(`Please enter an amount of at least ${minAmount} ${accountCurrency}`);
            return;
        }

        showQRModal(amount, accountCurrency, accountId);
    });

    function showQRModal(amount, currency, accountId) {
        const modal = document.getElementById('qr-modal');
        document.getElementById('qr-amount').textContent = amount.toFixed(2);
        document.getElementById('qr-currency').textContent = currency;
        modal.style.display = 'block';
        initiatePayment(accountId, amount, currency);
    }

    function generateReference() {
        return 'PAY' + Date.now().toString().slice(-8);
    }

    let currentPaymentId = null;
    let screenshotFile = null;

    async function initiatePayment(accountId, amount, currency) {
        try {
            const reference = generateReference();
            document.getElementById('payment-ref').textContent = reference;
            
            const response = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    account_id: accountId,
                    amount: amount,
                    currency: currency,
                    reference: reference
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentPaymentId = data.payment_id;
            }
        } catch (error) {
            console.error('Payment initiation error:', error);
        }
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
        if (!currentPaymentId || !screenshotFile) return;
        
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Uploading...';
        document.getElementById('payment-status').style.display = 'flex';
        
        try {
            const formData = new FormData();
            formData.append('screenshot', screenshotFile);
            
            const uploadResponse = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
                alert('Error uploading screenshot: ' + uploadData.message);
                btn.disabled = false;
                btn.textContent = 'I have completed the payment';
                document.getElementById('payment-status').style.display = 'none';
                return;
            }
            
            btn.textContent = 'Processing...';
            
            const response = await fetch(`/api/payment/simulate/${currentPaymentId}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('qr-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                alert('Error processing payment. Please contact support.');
                btn.disabled = false;
                btn.textContent = 'I have completed the payment';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            alert('Error processing payment. Please contact support.');
            btn.disabled = false;
            btn.textContent = 'I have completed the payment';
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
