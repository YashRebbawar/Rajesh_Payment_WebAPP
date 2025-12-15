document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const targetTab = this.dataset.tab;
        if (targetTab === 'signin') {
            window.location.href = '/signin';
        }
    });
});

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = document.getElementById(this.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        this.textContent = input.type === 'password' ? '👁' : '👁🗨';
    });
});

document.querySelector('.collapse-btn').addEventListener('click', function() {
    const content = this.nextElementSibling;
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
    this.textContent = content.style.display === 'block' ? 'Partner code (optional) ▲' : 'Partner code (optional) ▼';
});

const passwordInput = document.getElementById('register-password');
passwordInput.addEventListener('input', function() {
    const value = this.value;
    const requirements = {
        length: value.length >= 8 && value.length <= 15,
        case: /[a-z]/.test(value) && /[A-Z]/.test(value),
        number: /\d/.test(value),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(value)
    };
    
    Object.keys(requirements).forEach(rule => {
        const elem = document.querySelector(`[data-rule="${rule}"]`);
        if (requirements[rule]) {
            elem.style.color = '#00ff88';
            elem.textContent = elem.textContent.replace('○', '●');
        } else {
            elem.style.color = '#6c757d';
            elem.textContent = elem.textContent.replace('●', '○');
        }
    });
});

document.getElementById('register-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            window.location.href = result.redirect || '/signin';
        } else {
            alert(result.message);
        }
    } catch (error) {
        alert('Registration failed. Please try again.');
    }
});

document.getElementById('google-register').addEventListener('click', async function() {
    try {
        const response = await fetch('/auth/google');
        if (response.ok) {
            window.location.href = '/auth/google';
        } else {
            const data = await response.json();
            alert(data.error || 'Google sign-in is not configured. Please use email/password authentication.');
        }
    } catch (error) {
        window.location.href = '/auth/google';
    }
});
