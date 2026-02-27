document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-button');
    const nicknameInput = document.getElementById('nickname');
    const charCount = document.getElementById('char-count');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const setupForm = document.getElementById('setup-form');
    const passwordRules = {
        length: v => v.length >= 8 && v.length <= 15,
        case: v => /[a-z]/.test(v) && /[A-Z]/.test(v),
        number: v => /\d/.test(v),
        special: v => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v)
    };

    function isPasswordValid(password) {
        return Object.values(passwordRules).every(rule => rule(password));
    }

    if (backButton) {
        backButton.addEventListener('click', function() {
            window.history.back();
        });
    }

    nicknameInput.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });

    togglePasswordBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        this.textContent = type === 'password' ? '👁' : '👁';
    });

    passwordInput.addEventListener('input', function() {
        const password = this.value;
        const requirements = {
            length: passwordRules.length(password),
            case: passwordRules.case(password),
            number: passwordRules.number(password),
            special: passwordRules.special(password)
        };

        updateRequirement('req-length', requirements.length);
        updateRequirement('req-case', requirements.case);
        updateRequirement('req-number', requirements.number);
        updateRequirement('req-special', requirements.special);
    });

    function updateRequirement(id, met) {
        const element = document.getElementById(id);
        if (met) {
            element.classList.add('met');
            element.querySelector('.requirement-icon').textContent = '✓';
        } else {
            element.classList.remove('met');
            element.querySelector('.requirement-icon').textContent = '○';
        }
    }

    setupForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const password = document.getElementById('password').value;
        if (!isPasswordValid(password)) {
            const toast = document.createElement('div');
            toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 16px 24px; border-radius: 8px; z-index: 9999; font-weight: 600; max-width: 420px;';
            toast.textContent = 'Trading password must be 8-15 chars with upper/lowercase, number, and special character.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
            return;
        }

        const accountType = setupForm.dataset.accountType;
        const formData = {
            account_type: accountType,
            currency: document.getElementById('currency').value,
            nickname: document.getElementById('nickname').value,
            leverage: document.getElementById('leverage').value,
            platform: document.getElementById('platform').value,
            password: document.getElementById('password').value
        };

        fetch('/api/account-setup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(formData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.href = data.redirect;
            } else {
                const errorMsg = data.message || 'Failed to create account';
                const toast = document.createElement('div');
                toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 16px 24px; border-radius: 8px; z-index: 9999; font-weight: 600; max-width: 400px;';
                toast.textContent = errorMsg;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 4000);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while creating the account');
        });
    });
});
