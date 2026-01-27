document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const targetTab = this.dataset.tab;
        if (targetTab === 'register') {
            window.location.href = '/register';
        }
    });
});

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = document.getElementById(this.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        this.textContent = input.type === 'password' ? '👁' : '👁';
    });
});

document.getElementById('signin-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('.auth-submit-new');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span> Signing in...';
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/signin', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            window.location.href = result.redirect || '/my-accounts';
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            alert(result.message);
        }
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        alert('Sign in failed. Please try again.');
    }
});

document.getElementById('google-signin').addEventListener('click', async function() {
    this.disabled = true;
    this.innerHTML = '<span style="display:inline-block;width:18px;height:18px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span> Signing in...';
    
    setTimeout(() => {
        window.location.href = '/auth/google';
    }, 800);
});

const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
