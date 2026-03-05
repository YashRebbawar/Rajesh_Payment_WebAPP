/* ═══════════════════════════════════════════════════════
   payment.js  –  PrintFree themed + all original logic
═══════════════════════════════════════════════════════ */

/* ── Live clock (runs immediately, no DOMContentLoaded needed) ── */
function updateTime() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
    }
}
updateTime();
setInterval(updateTime, 1000);

function closeMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburger) hamburger.classList.remove('open');
    if (hamburgerMobile) hamburgerMobile.classList.remove('open');
    if (mobileNav) mobileNav.classList.remove('open');
}

/* ══════════════════════════════════════════════════════
   THEMED TOAST  (replaces all alert() calls)
══════════════════════════════════════════════════════ */
function showToast(msg, type = 'error') {
    let toast = document.getElementById('pf-pay-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pf-pay-toast';
        Object.assign(toast.style, {
            position:       'fixed',
            top:            '24px',
            left:           '50%',
            transform:      'translateX(-50%) translateY(-90px)',
            zIndex:         '9999',
            padding:        '12px 22px',
            borderRadius:   '100px',
            fontFamily:     '"Cabinet Grotesk", sans-serif',
            fontSize:       '13px',
            fontWeight:     '700',
            whiteSpace:     'nowrap',
            boxShadow:      '0 8px 32px rgba(26,21,16,0.18)',
            pointerEvents:  'none',
            transition:     'transform 0.42s cubic-bezier(0.22,1,0.36,1)',
        });
        document.body.appendChild(toast);
    }

    toast.style.background = type === 'success' ? '#2d7a4f' : '#1a1510';
    toast.style.color      = '#f7f6f2';
    toast.textContent      = msg;

    // force reflow
    toast.style.transform = 'translateX(-50%) translateY(-90px)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
    }));

    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-90px)';
    }, 4000);
}

/* ══════════════════════════════════════════════════════
   RECEIPT CARD live sync helper
══════════════════════════════════════════════════════ */
function syncReceipt(baseAmount) {
    const fee   = baseAmount * 0.014;
    const total = baseAmount + fee;

    const liveEl = document.getElementById('rcpt-live-total');
    if (liveEl) {
        liveEl.textContent = total > 0 ? total.toFixed(0) : '0';
        liveEl.classList.toggle('ticking', baseAmount > 0);
        clearTimeout(liveEl._tt);
        liveEl._tt = setTimeout(() => liveEl.classList.remove('ticking'), 600);
    }

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('rcpt-base',      baseAmount > 0 ? baseAmount.toFixed(0) : '—');
    setText('rcpt-fee',       baseAmount > 0 ? fee.toFixed(2)        : '—');
    setText('rcpt-total-row', baseAmount > 0 ? total.toFixed(0)      : '—');

    // also update deposit summary display
    setText('deposit-value', total.toFixed(0));
    setText('tooltip-amount', baseAmount.toFixed(2));
    setText('tooltip-fee',    fee.toFixed(2));
    setText('tooltip-total',  total.toFixed(2));

    const depositEl = document.getElementById('deposit-display');
    if (depositEl) {
        depositEl.classList.toggle('updated', baseAmount > 0);
        clearTimeout(depositEl._ut);
        depositEl._ut = setTimeout(() => depositEl.classList.remove('updated'), 600);
    }
}

/* ══════════════════════════════════════════════════════
   MAIN  –  DOMContentLoaded
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {

    /* ── Element refs ── */
    const amountInput        = document.getElementById('amount');
    const payButton          = document.getElementById('pay-button');
    const depositValueEl     = document.getElementById('deposit-value');

    if (!payButton) return; // safety guard

    const accountCurrency    = payButton.dataset.currency;
    const accountId          = payButton.dataset.accountId;
    const accountType        = payButton.dataset.accountType;
    const depositCurrency    = accountCurrency === 'USD' ? 'INR' : accountCurrency;

    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', () => {
            const isOpen = hamburger.classList.toggle('open');
            if (hamburgerMobile) hamburgerMobile.classList.toggle('open', isOpen);
            mobileNav.classList.toggle('open', isOpen);
        });
    }

    if (hamburgerMobile && mobileNav) {
        hamburgerMobile.addEventListener('click', () => {
            const isOpen = hamburgerMobile.classList.toggle('open');
            if (hamburger) hamburger.classList.toggle('open', isOpen);
            mobileNav.classList.toggle('open', isOpen);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileNav();
    });

    document.addEventListener('click', (e) => {
        if (!mobileNav || !mobileNav.classList.contains('open')) return;
        if (e.target.closest('#mobileNav')) return;
        if (e.target.closest('#hamburger') || e.target.closest('#hamburger-mobile')) return;
        closeMobileNav();
    });

    const minAmount = accountType === 'standard' ? 1000 : 50000;
    const maxAmount = 100000;

    /* ── Payment method selection ── */
    let selectedPaymentMethod = 'upi';
    const paymentMethodOptions = document.querySelectorAll('.payment-method-option');

    paymentMethodOptions.forEach(option => {
        option.addEventListener('click', function () {
            paymentMethodOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            selectedPaymentMethod = this.dataset.method;
        });
    });

    /* ── Amount input ── */
    amountInput.addEventListener('input', function () {
        const value   = parseFloat(this.value) || 0;
        const isValid = value >= minAmount && value <= maxAmount;

        // sync receipt card + summary
        syncReceipt(value);

        payButton.disabled = !isValid;
        payButton.classList.toggle('active', isValid);

        // float label helper
        document.getElementById('amount-field')
            ?.classList.toggle('filled', this.value !== '');
    });

    /* ── Continue button ── */
    payButton.addEventListener('click', async function (e) {
        e.preventDefault();
        const amount = parseFloat(amountInput.value);

        if (!amount || amount < minAmount) {
            showToast(`Minimum deposit is ${minAmount.toLocaleString()} ${depositCurrency}`, 'error');
            return;
        }

        if (amount > maxAmount) {
            showToast(`Maximum deposit is ${maxAmount.toLocaleString()} ${depositCurrency}`, 'error');
            return;
        }

        if (selectedPaymentMethod === 'upi') {
            showQRModal(amount, depositCurrency, accountId);
        } else {
            showIMPSModal(amount, depositCurrency, accountId);
        }
    });

    /* ═══════════════════════════════════════════
       SHARED STATE
    ═══════════════════════════════════════════ */
    let currentPaymentId        = null;
    let screenshotFile          = null;
    let impsScreenshotFile      = null;
    let pendingPaymentData      = null;
    let pendingIMPSPaymentData  = null;

    function generateReference() {
        return 'PAY' + Date.now().toString().slice(-8);
    }

    /* ═══════════════════════════════════════════
       UPI MODAL
    ═══════════════════════════════════════════ */
    function showQRModal(amount, currency, accountId) {
        const modal = document.getElementById('qr-modal');
        const fee   = amount * 0.014;
        const total = amount + fee;
        document.getElementById('qr-amount').textContent   = total.toFixed(2);
        document.getElementById('qr-currency').textContent = currency;
        modal.style.display = 'block';
        initializePaymentData(accountId, amount, currency);
    }

    function initializePaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('payment-ref').textContent = reference;
        pendingPaymentData = { accountId, amount, currency, reference };
    }

    /* Screenshot – UPI */
    document.getElementById('upload-screenshot-btn').addEventListener('click', () => {
        document.getElementById('screenshot-input').click();
    });

    document.getElementById('screenshot-input').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5 MB', 'error');
            return;
        }
        screenshotFile = file;
        document.getElementById('filename-text').textContent          = file.name;
        document.getElementById('screenshot-filename').style.display  = 'flex';
        document.getElementById('upload-screenshot-btn').style.display = 'none';
        document.getElementById('confirm-payment-btn').disabled        = false;
    });

    document.getElementById('remove-screenshot-btn').addEventListener('click', () => {
        screenshotFile = null;
        document.getElementById('screenshot-input').value              = '';
        document.getElementById('screenshot-filename').style.display  = 'none';
        document.getElementById('upload-screenshot-btn').style.display = 'flex';
        document.getElementById('confirm-payment-btn').disabled        = true;
    });

    /* Confirm – UPI */
    document.getElementById('confirm-payment-btn').addEventListener('click', async function () {
        if (!screenshotFile || !pendingPaymentData) return;

        const btn = this;
        btn.style.display = 'none';
        document.getElementById('payment-status').style.display = 'flex';

        try {
            // 1. Initiate
            const initiateRes  = await fetch('/api/payment/initiate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    account_id: pendingPaymentData.accountId,
                    amount:     pendingPaymentData.amount,
                    currency:   depositCurrency,
                    reference:  pendingPaymentData.reference,
                })
            });
            const initiateData = await initiateRes.json();
            if (!initiateData.success) {
                showToast('Error creating payment. Please try again.', 'error');
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
                return;
            }
            currentPaymentId = initiateData.payment_id;

            // 2. Upload screenshot
            const formData = new FormData();
            formData.append('screenshot', screenshotFile);
            const uploadRes  = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body:   formData,
            });
            const uploadData = await uploadRes.json();
            if (!uploadData.success) {
                showToast('Error uploading screenshot: ' + uploadData.message, 'error');
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
                return;
            }

            // 3. Simulate / finalise
            const res  = await fetch(`/api/payment/simulate/${currentPaymentId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                document.getElementById('qr-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                showToast('Error processing payment. Please contact support.', 'error');
                btn.style.display = 'block';
                document.getElementById('payment-status').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            showToast('Network error. Please contact support.', 'error');
            btn.style.display = 'block';
            document.getElementById('payment-status').style.display = 'none';
        }
    });

    /* Close UPI modal → discard prompt */
    document.querySelector('.qr-close').addEventListener('click', () => {
        document.getElementById('discard-modal').style.display = 'block';
    });
    window.addEventListener('click', e => {
        if (e.target === document.getElementById('qr-modal')) {
            document.getElementById('discard-modal').style.display = 'block';
        }
    });

    /* Swipe down to close UPI modal */
    const qrModalContent = document.querySelector('#qr-modal .qr-modal-content');
    let startY = 0, currentY = 0;
    qrModalContent.addEventListener('touchstart', e => {
        startY = e.touches[0].clientY;
    });
    qrModalContent.addEventListener('touchmove', e => {
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) qrModalContent.style.transform = `translateY(${diff}px)`;
    });
    qrModalContent.addEventListener('touchend', () => {
        const diff = currentY - startY;
        if (diff > 100) {
            document.getElementById('discard-modal').style.display = 'block';
        }
        qrModalContent.style.transform = '';
    });

    /* ═══════════════════════════════════════════
       IMPS MODAL
    ═══════════════════════════════════════════ */
    function showIMPSModal(amount, currency, accountId) {
        const modal = document.getElementById('imps-modal');
        const fee   = amount * 0.014;
        const total = amount + fee;
        document.getElementById('imps-amount').textContent   = total.toFixed(2);
        document.getElementById('imps-currency').textContent = currency;
        modal.style.display = 'block';
        initializeIMPSPaymentData(accountId, amount, currency);
    }

    function initializeIMPSPaymentData(accountId, amount, currency) {
        const reference = generateReference();
        document.getElementById('imps-payment-ref').textContent = reference;
        pendingIMPSPaymentData = { accountId, amount, currency, reference };
    }

    /* Screenshot – IMPS */
    document.getElementById('imps-upload-screenshot-btn').addEventListener('click', () => {
        document.getElementById('imps-screenshot-input').click();
    });

    document.getElementById('imps-screenshot-input').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast('File size must be less than 5 MB', 'error');
            return;
        }
        impsScreenshotFile = file;
        document.getElementById('imps-filename-text').textContent              = file.name;
        document.getElementById('imps-screenshot-filename').style.display     = 'flex';
        document.getElementById('imps-upload-screenshot-btn').style.display   = 'none';
        document.getElementById('imps-confirm-payment-btn').disabled           = false;
    });

    document.getElementById('imps-remove-screenshot-btn').addEventListener('click', () => {
        impsScreenshotFile = null;
        document.getElementById('imps-screenshot-input').value                  = '';
        document.getElementById('imps-screenshot-filename').style.display      = 'none';
        document.getElementById('imps-upload-screenshot-btn').style.display    = 'flex';
        document.getElementById('imps-confirm-payment-btn').disabled            = true;
    });

    /* Confirm – IMPS */
    document.getElementById('imps-confirm-payment-btn').addEventListener('click', async function () {
        if (!impsScreenshotFile || !pendingIMPSPaymentData) return;

        const btn = this;
        btn.style.display = 'none';
        document.getElementById('imps-payment-status').style.display = 'flex';

        try {
            // 1. Initiate
            const initiateRes  = await fetch('/api/payment/initiate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    account_id: pendingIMPSPaymentData.accountId,
                    amount:     pendingIMPSPaymentData.amount,
                    currency:   depositCurrency,
                    reference:  pendingIMPSPaymentData.reference,
                })
            });
            const initiateData = await initiateRes.json();
            if (!initiateData.success) {
                showToast('Error creating payment. Please try again.', 'error');
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
                return;
            }
            currentPaymentId = initiateData.payment_id;

            // 2. Upload screenshot
            const formData = new FormData();
            formData.append('screenshot', impsScreenshotFile);
            const uploadRes  = await fetch(`/api/payment/upload-screenshot/${currentPaymentId}`, {
                method: 'POST',
                body:   formData,
            });
            const uploadData = await uploadRes.json();
            if (!uploadData.success) {
                showToast('Error uploading screenshot: ' + uploadData.message, 'error');
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
                return;
            }

            // 3. Simulate / finalise
            const res  = await fetch(`/api/payment/simulate/${currentPaymentId}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                document.getElementById('imps-modal').style.display = 'none';
                document.getElementById('success-modal').style.display = 'block';
            } else {
                showToast('Error processing payment. Please contact support.', 'error');
                btn.style.display = 'block';
                document.getElementById('imps-payment-status').style.display = 'none';
            }
        } catch (error) {
            console.error('Payment confirmation error:', error);
            showToast('Network error. Please contact support.', 'error');
            btn.style.display = 'block';
            document.getElementById('imps-payment-status').style.display = 'none';
        }
    });

    /* Close IMPS modal → discard prompt */
    document.querySelector('.imps-close').addEventListener('click', () => {
        document.getElementById('discard-modal').style.display = 'block';
    });
    window.addEventListener('click', e => {
        if (e.target === document.getElementById('imps-modal')) {
            document.getElementById('discard-modal').style.display = 'block';
        }
    });

    /* Swipe down to close IMPS modal */
    const impsModalContent = document.querySelector('#imps-modal .qr-modal-content');
    let impsStartY = 0, impsCurrentY = 0;
    impsModalContent.addEventListener('touchstart', e => {
        impsStartY = e.touches[0].clientY;
    });
    impsModalContent.addEventListener('touchmove', e => {
        impsCurrentY = e.touches[0].clientY;
        const diff = impsCurrentY - impsStartY;
        if (diff > 0) impsModalContent.style.transform = `translateY(${diff}px)`;
    });
    impsModalContent.addEventListener('touchend', () => {
        const diff = impsCurrentY - impsStartY;
        if (diff > 100) {
            document.getElementById('discard-modal').style.display = 'block';
        }
        impsModalContent.style.transform = '';
    });

    /* ═══════════════════════════════════════════
       DISCARD MODAL
    ═══════════════════════════════════════════ */
    document.getElementById('discard-cancel-btn').addEventListener('click', () => {
        document.getElementById('discard-modal').style.display = 'none';
    });

    document.getElementById('discard-confirm-btn').addEventListener('click', () => {
        // Close all payment modals
        document.getElementById('discard-modal').style.display = 'none';
        document.getElementById('qr-modal').style.display      = 'none';
        document.getElementById('imps-modal').style.display    = 'none';

        // Reset UPI state
        currentPaymentId   = null;
        screenshotFile     = null;
        pendingPaymentData = null;
        document.getElementById('screenshot-input').value              = '';
        document.getElementById('screenshot-filename').style.display  = 'none';
        document.getElementById('upload-screenshot-btn').style.display = 'flex';
        document.getElementById('confirm-payment-btn').disabled        = true;
        document.getElementById('confirm-payment-btn').style.display   = 'block';
        document.getElementById('payment-status').style.display        = 'none';

        // Reset IMPS state
        impsScreenshotFile      = null;
        pendingIMPSPaymentData  = null;
        document.getElementById('imps-screenshot-input').value              = '';
        document.getElementById('imps-screenshot-filename').style.display  = 'none';
        document.getElementById('imps-upload-screenshot-btn').style.display = 'flex';
        document.getElementById('imps-confirm-payment-btn').disabled        = true;
        document.getElementById('imps-confirm-payment-btn').style.display   = 'block';
        document.getElementById('imps-payment-status').style.display        = 'none';
    });

    /* ═══════════════════════════════════════════
       PROFILE DROPDOWN
    ═══════════════════════════════════════════ */
    const profileToggle   = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
        document.addEventListener('click', function (e) {
            if (!document.querySelector('.user-profile-wrapper')?.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
    }

    /* ═══════════════════════════════════════════
       MEMBER SINCE
    ═══════════════════════════════════════════ */
    const createdAtEl = document.querySelector('[data-user-created-at]');
    const memberSince = document.getElementById('member-since');
    if (createdAtEl && memberSince) {
        const date = new Date(createdAtEl.getAttribute('data-user-created-at'));
        memberSince.textContent = date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

}); // end DOMContentLoaded
