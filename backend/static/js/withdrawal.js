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
    const bankAccountInput = document.getElementById('bank-account');
    const ifscCodeInput = document.getElementById('ifsc-code');
    const continueButton = document.getElementById('continue-button');
    const confirmationModal = document.getElementById('confirmation-modal');
    const successModal = document.getElementById('success-modal');
    const discardModal = document.getElementById('discard-modal');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const confirmationClose = document.querySelector('.confirmation-close');
    const confirmationModalContent = document.querySelector('#confirmation-modal .confirmation-modal-content');
    const confirmationModalHandle = document.querySelector('#confirmation-modal .modal-handle');
    const discardCancelBtn = document.getElementById('discard-cancel-btn');
    const discardConfirmBtn = document.getElementById('discard-confirm-btn');
    const slipLiveAmount = document.getElementById('s-live-amount');
    const slipUpi = document.getElementById('s-upi-val');
    const paymentMethodSelect = document.getElementById('payment-method-select');
    const upiFieldGroup = document.getElementById('upi-field-group');
    const bankFieldGroup = document.getElementById('bank-field-group');
    const ifscFieldGroup = document.getElementById('ifsc-field-group');
    const saveUpiCheckbox = document.getElementById('save-upi-checkbox');
    const saveBankCheckbox = document.getElementById('save-bank-checkbox');

    let selectedPaymentMethod = 'upi';

    async function loadSavedCredentials() {
        try {
            const response = await fetch('/api/withdrawal/saved-credentials');
            const data = await response.json();
            if (data.success) {
                if (data.upi_id) {
                    upiIdInput.value = data.upi_id;
                    document.getElementById('upi-field').classList.add('filled');
                    saveUpiCheckbox.checked = true;
                }
                if (data.bank_account) {
                    bankAccountInput.value = data.bank_account;
                    document.getElementById('bank-field').classList.add('filled');
                }
                if (data.ifsc_code) {
                    ifscCodeInput.value = data.ifsc_code;
                    document.getElementById('ifsc-field').classList.add('filled');
                    saveBankCheckbox.checked = true;
                }
            }
        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    }

    async function saveCredentials() {
        try {
            await fetch('/api/withdrawal/save-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    upi_id: saveUpiCheckbox.checked ? upiIdInput.value : null,
                    bank_account: saveBankCheckbox.checked ? bankAccountInput.value : null,
                    ifsc_code: saveBankCheckbox.checked ? ifscCodeInput.value : null
                })
            });
        } catch (error) {
            console.error('Error saving credentials:', error);
        }
    }

    loadSavedCredentials();

    saveUpiCheckbox.addEventListener('change', saveCredentials);
    saveBankCheckbox.addEventListener('change', saveCredentials);

    paymentMethodSelect.addEventListener('change', () => {
        selectedPaymentMethod = paymentMethodSelect.value;
        
        if (selectedPaymentMethod === 'upi') {
            upiFieldGroup.style.display = 'block';
            bankFieldGroup.style.display = 'none';
            ifscFieldGroup.style.display = 'none';
        } else {
            upiFieldGroup.style.display = 'none';
            bankFieldGroup.style.display = 'block';
            ifscFieldGroup.style.display = 'block';
        }
        updateButtonState();
    });

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

        if (slipUpi) {
            const upiValid = validateUpiId(upiId);
            slipUpi.textContent = upiId || '-';
            slipUpi.classList.toggle('valid', upiValid);
        }
    }

    function updateButtonState() {
        const amount = parseFloat(amountInput.value) || 0;
        const upiValid = selectedPaymentMethod === 'upi' ? validateUpiId(upiIdInput.value.trim()) : true;
        const bankValid = selectedPaymentMethod === 'bank' ? (bankAccountInput.value.trim() && ifscCodeInput.value.trim()) : true;
        
        let amountValid = false;
        if (selectedPaymentMethod === 'upi') {
            amountValid = amount >= 10 && amount <= 50 && amount <= accountBalance;
        } else {
            amountValid = amount >= 50 && amount <= accountBalance;
        }

        if (amountValid && upiValid && bankValid) {
            continueButton.classList.add('active');
            continueButton.disabled = false;
        } else {
            continueButton.classList.remove('active');
            continueButton.disabled = true;
        }
    }

    amountInput.addEventListener('input', () => {
        syncSettlementSlip();
        updateButtonState();
    });

    upiIdInput.addEventListener('input', () => {
        syncSettlementSlip();
        updateButtonState();
    });

    bankAccountInput.addEventListener('input', updateButtonState);
    ifscCodeInput.addEventListener('input', updateButtonState);

    continueButton.addEventListener('click', () => {
        const amount = parseFloat(amountInput.value) || 0;
        const upiId = upiIdInput.value.trim();
        const bankAccount = bankAccountInput.value.trim();
        const ifscCode = ifscCodeInput.value.trim();

        if (amount <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        if (selectedPaymentMethod === 'upi') {
            if (amount < 10 || amount > 50) {
                alert('UPI withdrawal amount must be between $10 and $50');
                return;
            }
            if (amount > accountBalance) {
                alert('Insufficient balance. Your account balance is ' + accountBalance + ' ' + currency);
                return;
            }
            if (!validateUpiId(upiId)) {
                alert('Please enter a valid UPI ID (e.g., example@upi)');
                return;
            }
        } else {
            if (amount < 50) {
                alert('Bank transfer withdrawal amount must be at least $50');
                return;
            }
            if (amount > accountBalance) {
                alert('Insufficient balance. Your account balance is ' + accountBalance + ' ' + currency);
                return;
            }
            if (!bankAccount) {
                alert('Please enter your bank account number');
                return;
            }
            if (!ifscCode) {
                alert('Please enter your IFSC code');
                return;
            }
        }

        document.getElementById('confirm-amount').textContent = amount.toFixed(2);
        document.getElementById('confirm-currency').textContent = currency;
        if (selectedPaymentMethod === 'upi') {
            document.getElementById('confirm-upi').textContent = upiId;
            document.querySelector('.detail-row:nth-child(2) .detail-label').textContent = 'UPI destination';
        } else {
            document.getElementById('confirm-upi').textContent = bankAccount + ' (' + ifscCode + ')';
            document.querySelector('.detail-row:nth-child(2) .detail-label').textContent = 'Bank account';
        }
        confirmationModal.style.display = 'block';
    });

    confirmationClose.addEventListener('click', () => {
        discardModal.style.display = 'block';
    });

    cancelBtn.addEventListener('click', () => {
        discardModal.style.display = 'block';
    });

    confirmBtn.addEventListener('click', async () => {
        const amount = parseFloat(amountInput.value);
        const upiId = upiIdInput.value.trim();
        const bankAccount = bankAccountInput.value.trim();
        const ifscCode = ifscCodeInput.value.trim();

        saveCredentials();

        const payload = {
            account_id: accountId,
            amount: amount,
            currency: currency,
            payment_method: selectedPaymentMethod
        };

        if (selectedPaymentMethod === 'upi') {
            payload.upi_id = upiId;
        } else {
            payload.bank_account = bankAccount;
            payload.ifsc_code = ifscCode;
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
            discardModal.style.display = 'block';
        }
        if (event.target === discardModal) {
            discardModal.style.display = 'none';
        }
        if (event.target === successModal) {
            successModal.style.display = 'none';
        }
    });

    let swipeStartY = 0;
    let swipeCurrentY = 0;
    let isHandleSwipeActive = false;

    if (confirmationModalHandle && confirmationModalContent) {
        confirmationModalHandle.addEventListener('touchstart', (event) => {
            isHandleSwipeActive = true;
            swipeStartY = event.touches[0].clientY;
            swipeCurrentY = swipeStartY;
        });

        confirmationModalContent.addEventListener('touchmove', (event) => {
            if (!isHandleSwipeActive) return;
            swipeCurrentY = event.touches[0].clientY;
            const diff = swipeCurrentY - swipeStartY;
            if (diff > 0) {
                confirmationModalContent.style.transform = `translateY(${diff}px)`;
            }
        });

        confirmationModalContent.addEventListener('touchend', () => {
            if (!isHandleSwipeActive) return;
            const diff = swipeCurrentY - swipeStartY;
            if (diff > 100) {
                discardModal.style.display = 'block';
            }
            confirmationModalContent.style.transform = '';
            isHandleSwipeActive = false;
            swipeStartY = 0;
            swipeCurrentY = 0;
        });
    }

    if (discardCancelBtn) {
        discardCancelBtn.addEventListener('click', () => {
            discardModal.style.display = 'none';
        });
    }

    if (discardConfirmBtn) {
        discardConfirmBtn.addEventListener('click', () => {
            discardModal.style.display = 'none';
            confirmationModal.style.display = 'none';
        });
    }

    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 10);
        }
    });

    syncSettlementSlip();
    updateButtonState();
});
