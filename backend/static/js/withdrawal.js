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
    const amountField = document.getElementById('amount-field');
    const upiField = document.getElementById('upi-field');
    const bankField = document.getElementById('bank-field');
    const ifscField = document.getElementById('ifsc-field');
    const amountError = document.getElementById('amount-error');
    const upiError = document.getElementById('upi-error');
    const bankAccountError = document.getElementById('bank-account-error');
    const ifscError = document.getElementById('ifsc-error');

    let selectedPaymentMethod = 'upi';
    const touchedFields = {
        amount: false,
        upi: false,
        bankAccount: false,
        ifsc: false
    };

    async function loadSavedCredentials() {
        try {
            const response = await fetch('/api/withdrawal/saved-credentials');
            const data = await response.json();
            if (data.success) {
                if (data.upi_id) {
                    upiIdInput.value = data.upi_id;
                    upiField.classList.add('filled');
                    saveUpiCheckbox.checked = true;
                }
                if (data.bank_account) {
                    bankAccountInput.value = data.bank_account;
                    bankField.classList.add('filled');
                }
                if (data.ifsc_code) {
                    ifscCodeInput.value = data.ifsc_code.toUpperCase();
                    ifscField.classList.add('filled');
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
                    upi_id: saveUpiCheckbox.checked ? upiIdInput.value.trim() : null,
                    bank_account: saveBankCheckbox.checked ? bankAccountInput.value.trim() : null,
                    ifsc_code: saveBankCheckbox.checked ? ifscCodeInput.value.trim().toUpperCase() : null
                })
            });
        } catch (error) {
            console.error('Error saving credentials:', error);
        }
    }

    function validateUpiId(upi) {
        return /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/.test(upi);
    }

    function validateBankAccount(accountNumber) {
        return /^\d{9,18}$/.test(accountNumber);
    }

    function validateIfscCode(ifscCode) {
        return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode);
    }

    function setFieldError(fieldWrapper, errorElement, message) {
        if (!fieldWrapper || !errorElement) return;
        fieldWrapper.classList.toggle('has-error', Boolean(message));
        errorElement.textContent = message || '';
    }

    function getValidationErrors() {
        const amount = parseFloat(amountInput.value) || 0;
        const upiId = upiIdInput.value.trim();
        const bankAccount = bankAccountInput.value.trim();
        const ifscCode = ifscCodeInput.value.trim().toUpperCase();
        const errors = {
            amount: '',
            upi: '',
            bankAccount: '',
            ifsc: ''
        };

        if (amount <= 0) {
            errors.amount = 'Enter a valid withdrawal amount.';
        } else if (selectedPaymentMethod === 'upi' && (amount < 10 || amount > 50)) {
            errors.amount = 'UPI withdrawals must be between $10 and $50.';
        } else if (selectedPaymentMethod === 'bank' && amount < 50) {
            errors.amount = 'Bank transfer withdrawals must be at least $50.';
        } else if (amount > accountBalance) {
            errors.amount = `Amount exceeds available balance of ${accountBalance} ${currency}.`;
        }

        if (selectedPaymentMethod === 'upi') {
            if (!upiId) {
                errors.upi = 'Enter your UPI ID.';
            } else if (!validateUpiId(upiId)) {
                errors.upi = 'Enter a valid UPI ID like name@upi.';
            }
        } else {
            if (!bankAccount) {
                errors.bankAccount = 'Enter your bank account number.';
            } else if (!validateBankAccount(bankAccount)) {
                errors.bankAccount = 'Use 9 to 18 digits for the account number.';
            }

            if (!ifscCode) {
                errors.ifsc = 'Enter your IFSC code.';
            } else if (!validateIfscCode(ifscCode)) {
                errors.ifsc = 'Enter a valid IFSC code like SBIN0001234.';
            }
        }

        return errors;
    }

    function renderValidationState(showErrors = false) {
        const errors = getValidationErrors();
        const showAmountError = showErrors || touchedFields.amount;
        const showUpiError = showErrors || touchedFields.upi;
        const showBankAccountError = showErrors || touchedFields.bankAccount;
        const showIfscError = showErrors || touchedFields.ifsc;

        setFieldError(amountField, amountError, showAmountError ? errors.amount : '');
        setFieldError(upiField, upiError, selectedPaymentMethod === 'upi' && showUpiError ? errors.upi : '');
        setFieldError(bankField, bankAccountError, selectedPaymentMethod === 'bank' && showBankAccountError ? errors.bankAccount : '');
        setFieldError(ifscField, ifscError, selectedPaymentMethod === 'bank' && showIfscError ? errors.ifsc : '');

        if (selectedPaymentMethod === 'upi') {
            setFieldError(bankField, bankAccountError, '');
            setFieldError(ifscField, ifscError, '');
        } else {
            setFieldError(upiField, upiError, '');
        }

        return errors;
    }

    function syncSettlementSlip() {
        const amount = parseFloat(amountInput.value) || 0;
        const destination = selectedPaymentMethod === 'upi'
            ? upiIdInput.value.trim()
            : bankAccountInput.value.trim();
        const destinationValid = selectedPaymentMethod === 'upi'
            ? validateUpiId(destination)
            : validateBankAccount(destination);

        if (slipLiveAmount) {
            slipLiveAmount.textContent = amount > 0 ? amount.toFixed(2) : '0';
            slipLiveAmount.classList.toggle('ticking', amount > 0);
        }

        if (slipUpi) {
            slipUpi.textContent = destination || '-';
            slipUpi.classList.toggle('valid', destinationValid);
        }
    }

    function updateButtonState() {
        const errors = getValidationErrors();
        const isValid = !errors.amount && !errors.upi && !errors.bankAccount && !errors.ifsc;

        continueButton.classList.toggle('active', isValid);
        continueButton.disabled = !isValid;
    }

    loadSavedCredentials().finally(() => {
        syncSettlementSlip();
        updateButtonState();
    });

    saveUpiCheckbox.addEventListener('change', saveCredentials);
    saveBankCheckbox.addEventListener('change', saveCredentials);

    paymentMethodSelect.addEventListener('change', () => {
        selectedPaymentMethod = paymentMethodSelect.value;

        if (selectedPaymentMethod === 'upi') {
            upiFieldGroup.style.display = 'block';
            bankFieldGroup.style.display = 'none';
            ifscFieldGroup.style.display = 'none';
            document.getElementById('processing-time').textContent = '~15 minutes';
            document.getElementById('method-display').textContent = 'UPI';
        } else {
            upiFieldGroup.style.display = 'none';
            bankFieldGroup.style.display = 'block';
            ifscFieldGroup.style.display = 'block';
            document.getElementById('processing-time').textContent = '~30 minutes';
            document.getElementById('method-display').textContent = 'Bank Transfer';
        }

        renderValidationState(false);
        syncSettlementSlip();
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

    amountInput.addEventListener('input', () => {
        syncSettlementSlip();
        renderValidationState();
        updateButtonState();
    });

    upiIdInput.addEventListener('input', () => {
        syncSettlementSlip();
        renderValidationState();
        updateButtonState();
    });

    bankAccountInput.addEventListener('input', () => {
        bankAccountInput.value = bankAccountInput.value.replace(/\D/g, '');
        syncSettlementSlip();
        renderValidationState();
        updateButtonState();
    });

    ifscCodeInput.addEventListener('input', () => {
        ifscCodeInput.value = ifscCodeInput.value.toUpperCase();
        renderValidationState();
        updateButtonState();
    });

    amountInput.addEventListener('blur', () => {
        touchedFields.amount = true;
        renderValidationState();
    });

    upiIdInput.addEventListener('blur', () => {
        touchedFields.upi = true;
        renderValidationState();
    });

    bankAccountInput.addEventListener('blur', () => {
        touchedFields.bankAccount = true;
        renderValidationState();
    });

    ifscCodeInput.addEventListener('blur', () => {
        touchedFields.ifsc = true;
        renderValidationState();
    });

    continueButton.addEventListener('click', () => {
        const errors = renderValidationState(true);
        if (errors.amount || errors.upi || errors.bankAccount || errors.ifsc) return;

        const amount = parseFloat(amountInput.value) || 0;
        const upiId = upiIdInput.value.trim();
        const bankAccount = bankAccountInput.value.trim();
        const ifscCode = ifscCodeInput.value.trim().toUpperCase();

        document.getElementById('confirm-amount').textContent = amount.toFixed(2);
        document.getElementById('confirm-currency').textContent = currency;
        if (selectedPaymentMethod === 'upi') {
            document.getElementById('confirm-upi').textContent = upiId;
            document.querySelector('.detail-row:nth-child(2) .detail-label').textContent = 'UPI destination';
        } else {
            document.getElementById('confirm-upi').textContent = `${bankAccount} (${ifscCode})`;
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
        const errors = renderValidationState(true);
        if (errors.amount || errors.upi || errors.bankAccount || errors.ifsc) {
            confirmationModal.style.display = 'none';
            return;
        }

        const amount = parseFloat(amountInput.value);
        const upiId = upiIdInput.value.trim();
        const bankAccount = bankAccountInput.value.trim();
        const ifscCode = ifscCodeInput.value.trim().toUpperCase();

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
                confirmationModal.style.display = 'none';
                setFieldError(amountField, amountError, data.message || 'Withdrawal failed');
            }
        } catch (error) {
            console.error('Error:', error);
            confirmationModal.style.display = 'none';
            setFieldError(amountField, amountError, 'An error occurred. Please try again.');
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
    renderValidationState(false);
    updateButtonState();
});
