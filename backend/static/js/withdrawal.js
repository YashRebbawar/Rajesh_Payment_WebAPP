function updateTime() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
}

function closeMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');

    if (hamburger) hamburger.classList.remove('open');
    if (hamburgerMobile) hamburgerMobile.classList.remove('open');
    if (mobileNav) mobileNav.classList.remove('open');
}

updateTime();
setInterval(updateTime, 1000);

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
    const slipLiveAmount = document.getElementById('s-live-amount');
    const slipRequested = document.getElementById('s-requested');
    const slipReceive = document.getElementById('s-receive');
    const slipUpi = document.getElementById('s-upi-val');

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

    const createdEl = document.querySelector('[data-user-created-at]');
    const memberSinceEl = document.getElementById('member-since');
    if (createdEl && memberSinceEl) {
        const createdAt = createdEl.getAttribute('data-user-created-at');
        if (createdAt) {
            memberSinceEl.textContent = new Date(createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!document.querySelector('.user-profile-wrapper')?.contains(e.target)) {
                profileDropdown.classList.remove('active');
            }
        });
    }

    let accountBalance = parseFloat(continueButton.dataset.accountBalance);
    if (isNaN(accountBalance) || accountBalance === 0) {
        accountBalance = 999999;
    }

    const currency = continueButton.dataset.currency;
    const accountId = continueButton.dataset.accountId;

    function validateUpiId(upi) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi);
    }

    function syncSettlementSlip() {
        const amount = parseFloat(amountInput.value) || 0;
        const upiId = upiIdInput.value.trim();

        if (slipLiveAmount) {
            slipLiveAmount.textContent = amount > 0 ? amount.toFixed(2) : '0';
            slipLiveAmount.classList.toggle('ticking', amount > 0);
        }

        if (slipRequested) {
            slipRequested.textContent = amount > 0 ? `${amount.toFixed(2)} ${currency}` : '-';
        }

        if (slipReceive) {
            slipReceive.textContent = amount > 0 ? `${amount.toFixed(2)} ${currency}` : '-';
        }

        if (slipUpi) {
            const upiValid = validateUpiId(upiId);
            slipUpi.textContent = upiId || '-';
            slipUpi.classList.toggle('valid', upiValid);
        }
    }

    function updateButtonState() {
        const amount = parseFloat(amountInput.value) || 0;
        const upiValid = validateUpiId(upiIdInput.value.trim());

        if (amount > 0 && upiValid) {
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

        syncSettlementSlip();
        updateButtonState();
    });

    upiIdInput.addEventListener('input', () => {
        syncSettlementSlip();
        updateButtonState();
    });

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
        document.getElementById('confirm-upi').textContent = upiId;
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
            successModal.style.display = 'none';
        }
    });

    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 10);
        }
    });

    syncSettlementSlip();
    updateButtonState();
});
