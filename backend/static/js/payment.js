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
    const maxAmount = 100000;

    // Load maintenance status
    let maintenanceStatus = { upi_maintenance: false, imps_maintenance: false };
    
    async function loadMaintenanceStatus() {
        try {
            const response = await fetch('/api/maintenance/status');
            const data = await response.json();
            if (data.success) {
                maintenanceStatus = data;
                updatePaymentMethodsUI();
            }
        } catch (error) {
            console.error('Error loading maintenance status:', error);
        }
    }
    
    function updatePaymentMethodsUI() {
        const upiOption = document.querySelector('[data-method="upi"]');
        const impsOption = document.querySelector('[data-method="imps"]');
        
        if (maintenanceStatus.upi_maintenance) {
            upiOption.classList.add('maintenance-mode');
            upiOption.style.opacity = '0.5';
            upiOption.style.cursor = 'not-allowed';
            if (upiOption.classList.contains('active')) {
                upiOption.classList.remove('active');
                if (!maintenanceStatus.imps_maintenance) {
                    impsOption.classList.add('active');
                    selectedPaymentMethod = 'imps';
                }
            }
        } else {
            upiOption.classList.remove('maintenance-mode');
            upiOption.style.opacity = '1';
            upiOption.style.cursor = 'pointer';
        }
        
        if (maintenanceStatus.imps_maintenance) {
            impsOption.classList.add('maintenance-mode');
            impsOption.style.opacity = '0.5';
            impsOption.style.cursor = 'not-allowed';
            if (impsOption.classList.contains('active')) {
                impsOption.classList.remove('active');
                if (!maintenanceStatus.upi_maintenance) {
                    upiOption.classList.add('active');
                    selectedPaymentMethod = 'upi';
                }
            }
        } else {
            impsOption.classList.remove('maintenance-mode');
            impsOption.style.opacity = '1';
            impsOption.style.cursor = 'pointer';
        }
        
        if (maintenanceStatus.upi_maintenance && maintenanceStatus.imps_maintenance) {
            payButton.disabled = true;
            payButton.textContent = 'Payment methods under maintenance';
        }
    }
    
    loadMaintenanceStatus();

    function showMaintenanceAlert(method) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'maintenance-alert';
        alertDiv.innerHTML = `
            <div class="maintenance-alert-content">
                <div class="maintenance-alert-icon">🔧</div>
                <div class="maintenance-alert-text">
                    <h3>${method} is currently under maintenance</h3>
                    <p>Please try another payment method.</p>
                </div>
                <button class="maintenance-alert-close" onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.classList.add('show'), 10);
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 300);
        }, 4000);
    }

    // Payment method selection
    let selectedPaymentMethod = 'upi';
    const paymentMethodOptions = document.querySelectorAll('.payment-method-option');
    
    paymentMethodOptions.forEach(option => {
        option.addEventListener('click', function() {
            const method = this.dataset.method;
            if ((method === 'upi' && maintenanceStatus.upi_maintenance) || 
                (method === 'imps' && maintenanceStatus.imps_maintenance)) {
                showMaintenanceAlert(method.toUpperCase());
                return;
            }
            paymentMethodOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            selectedPaymentMethod = this.dataset.method;
        });
    });

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
        
        if ((selectedPaymentMethod === 'upi' && maintenanceStatus.upi_maintenance) || 
            (selectedPaymentMethod === 'imps' && maintenanceStatus.imps_maintenance)) {
            showMaintenanceAlert(selectedPaymentMethod.toUpperCase());
            return;
        }

        if (selectedPaymentMethod === 'upi') {
            showQRModal(amount, depositCurrency, accountId);
        } else if (selectedPaymentMethod === 'imps') {
            showIMPSModal(amount, depositCurrency, accountId);
        } else if (selectedPaymentMethod === 'usdt') {
            showUSDTModal(amount, depositCurrency, accountId);
        }
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

    function showIMPSModal(amount, currency, accountId) {
        const modal = document.getElementById('imps-modal');
        const fee = amount * 0.014;
        const total = amount + fee;
        document.getElementById('imps-amount').textContent = total.toFixed(2);
        document.getElementById('imps-currency').textContent = currency;
        modal.style.display = 'block';
        initializeIMPSPaymentData(accountId, amount, currency);
    }

    function showUSDTModal(amount, currency, accountId) {
        const modal = document.getElementById('usdt-modal');
        const fee = amount * 0.014;
        const total = amount + fee;
        document.getElementById('usdt-amount').textContent = total.toFixed(2);
        document.getElementById('usdt-currency').textContent = currency;
        modal.style.display = 'block';
        initializeUSDTPaymentData(accountId, amount, currency);
    }

    function generateReference() {
        return 'PAY' + Date.now().toString().slice(-8);
    }

    let currentPaymentId = null;
    let screenshotFile = null;
    let pendingPaymentData = null;
    let impsScreenshotFile = null;
    let pendingIMPSPaymentData = null;
    let usdtScreenshotFile = null;
    let pendingUSDTPaymentData = null;

    function initializePaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('payment-ref').textContent = reference;
        pendingPaymentData = { accountId, amount, currency, reference };
    }

    function initializeIMPSPaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('imps-payment-ref').textContent = reference;
        pendingIMPSPaymentData = { accountId, amount, currency, reference };
    }

    function initializeUSDTPaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('usdt-payment-ref').textContent = reference;
        pendingUSDTPaymentData = { accountId, amount, currency, reference };
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
        document.getElementById('imps-modal').style.display = 'none';
        document.getElementById('usdt-modal').style.display = 'none';
        currentPaymentId = null;
        screenshotFile = null;
        pendingPaymentData = null;
        impsScreenshotFile = null;
        pendingIMPSPaymentData = null;
        usdtScreenshotFile = null;
        pendingUSDTPaymentData = null;
        document.getElementById('screenshot-input').value = '';
        document.getElementById('screenshot-filename').style.display = 'none';
        document.getElementById('upload-screenshot-btn').style.display = 'flex';
        document.getElementById('confirm-payment-btn').disabled = true;
        document.getElementById('imps-screenshot-input').value = '';
        document.getElementById('imps-screenshot-filename').style.display = 'none';
        document.getElementById('imps-upload-screenshot-btn').style.display = 'flex';
        document.getElementById('imps-confirm-payment-btn').disabled = true;
        document.getElementById('usdt-screenshot-input').value = '';
        document.getElementById('usdt-screenshot-filename').style.display = 'none';
        document.getElementById('usdt-upload-screenshot-btn').style.display = 'flex';
        document.getElementById('usdt-confirm-payment-btn').disabled = true;
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

    // IMPS Modal handlers
    document.getElementById('imps-upload-screenshot-btn').addEventListener('click', function() {
        document.getElementById('imps-screenshot-input').click();
    });

    document.getElementById('imps-screenshot-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            
            impsScreenshotFile = file;
            document.getElementById('imps-filename-text').textContent = file.name;
            document.getElementById('imps-screenshot-filename').style.display = 'flex';
            document.getElementById('imps-upload-screenshot-btn').style.display = 'none';
            document.getElementById('imps-confirm-payment-btn').disabled = false;
        }
    });

    document.getElementById('imps-remove-screenshot-btn').addEventListener('click', function() {
        impsScreenshotFile = null;
        document.getElementById('imps-screenshot-input').value = '';
        document.getElementById('imps-screenshot-filename').style.display = 'none';
        document.getElementById('imps-upload-screenshot-btn').style.display = 'flex';
        document.getElementById('imps-confirm-payment-btn').disabled = true;
    });

    document.getElementById('imps-confirm-payment-btn').addEventListener('click', async function() {
        if (!impsScreenshotFile || !pendingIMPSPaymentData) return;
        
        const btn = this;
        btn.style.display = 'none';
        document.getElementById('imps-payment-status').style.display = 'flex';
        
        try {
            const initiateResponse = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    account_id: pendingIMPSPaymentData.accountId,
                    amount: pendingIMPSPaymentData.amount,
                    currency: depositCurrency,
                    reference: pendingIMPSPaymentData.reference
                })
            });
            
            const initiateData = await initiateResponse.json();
            if (!initiateData.success) {
                alert('Error creating payment. Please try again.');
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
                return;
            }
            
            currentPaymentId = initiateData.payment_id;
            
            const formData = new FormData();
            formData.append('screenshot', impsScreenshotFile);
            
            const uploadResponse = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
                alert('Error uploading screenshot: ' + uploadData.message);
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
                return;
            }
            
            const response = await fetch(`/api/payment/simulate/${currentPaymentId}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('imps-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                alert('Error processing payment. Please contact support.');
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            alert('Error processing payment. Please contact support.');
            btn.style.display = 'block';
            document.getElementById('imps-payment-status').style.display = 'none';
        }
    });

    document.querySelector('.imps-close').addEventListener('click', function() {
        document.getElementById('discard-modal').style.display = 'block';
    });

    window.addEventListener('click', function(event) {
        const impsModal = document.getElementById('imps-modal');
        if (event.target === impsModal) {
            document.getElementById('discard-modal').style.display = 'block';
        }
    });

    // USDT Modal handlers
    document.getElementById('usdt-upload-screenshot-btn').addEventListener('click', function() {
        document.getElementById('usdt-screenshot-input').click();
    });

    document.getElementById('usdt-screenshot-input').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                return;
            }
            
            usdtScreenshotFile = file;
            document.getElementById('usdt-filename-text').textContent = file.name;
            document.getElementById('usdt-screenshot-filename').style.display = 'flex';
            document.getElementById('usdt-upload-screenshot-btn').style.display = 'none';
            document.getElementById('usdt-confirm-payment-btn').disabled = false;
        }
    });

    document.getElementById('usdt-remove-screenshot-btn').addEventListener('click', function() {
        usdtScreenshotFile = null;
        document.getElementById('usdt-screenshot-input').value = '';
        document.getElementById('usdt-screenshot-filename').style.display = 'none';
        document.getElementById('usdt-upload-screenshot-btn').style.display = 'flex';
        document.getElementById('usdt-confirm-payment-btn').disabled = true;
    });

    document.getElementById('usdt-confirm-payment-btn').addEventListener('click', async function() {
        if (!usdtScreenshotFile || !pendingUSDTPaymentData) return;
        
        const btn = this;
        btn.style.display = 'none';
        document.getElementById('usdt-payment-status').style.display = 'flex';
        
        try {
            const initiateResponse = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    account_id: pendingUSDTPaymentData.accountId,
                    amount: pendingUSDTPaymentData.amount,
                    currency: depositCurrency,
                    reference: pendingUSDTPaymentData.reference
                })
            });
            
            const initiateData = await initiateResponse.json();
            if (!initiateData.success) {
                alert('Error creating payment. Please try again.');
                btn.style.display = 'block';
                document.getElementById('usdt-payment-status').style.display = 'none';
                return;
            }
            
            currentPaymentId = initiateData.payment_id;
            
            const formData = new FormData();
            formData.append('screenshot', usdtScreenshotFile);
            
            const uploadResponse = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
                alert('Error uploading screenshot: ' + uploadData.message);
                btn.style.display = 'block';
                document.getElementById('usdt-payment-status').style.display = 'none';
                return;
            }
            
            const response = await fetch(`/api/payment/simulate/${currentPaymentId}`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('usdt-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                alert('Error processing payment. Please contact support.');
                btn.style.display = 'block';
                document.getElementById('usdt-payment-status').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            alert('Error processing payment. Please contact support.');
            btn.style.display = 'block';
            document.getElementById('usdt-payment-status').style.display = 'none';
        }
    });

    document.querySelector('.usdt-close').addEventListener('click', function() {
        document.getElementById('discard-modal').style.display = 'block';
    });

    window.addEventListener('click', function(event) {
        const usdtModal = document.getElementById('usdt-modal');
        if (event.target === usdtModal) {
            document.getElementById('discard-modal').style.display = 'block';
        }
    });
});
