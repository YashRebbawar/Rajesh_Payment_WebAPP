document.addEventListener('DOMContentLoaded', function() {
    const backButton = document.getElementById('back-button');
    const nicknameInput = document.getElementById('nickname');
    const charCount = document.getElementById('char-count');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const setupForm = document.getElementById('setup-form');

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
            length: password.length >= 8 && password.length <= 15,
            case: /[a-z]/.test(password) && /[A-Z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
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
                alert(data.message || 'Failed to create account');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while creating the account');
        });
    });
});
