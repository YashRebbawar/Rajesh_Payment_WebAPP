document.addEventListener('DOMContentLoaded', function () {

    /* ═══════════════════════════════════════════
       HAMBURGER MENU & NAVBAR
    ═══════════════════════════════════════════ */
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');
    const navbar = document.getElementById('navbar');

    if (hamburger && mobileNav) {
        hamburger.addEventListener('click', () => {
            const isOpen = hamburger.classList.toggle('open');
            mobileNav.classList.toggle('open', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });
    }

    if (hamburgerMobile && mobileNav) {
        hamburgerMobile.addEventListener('click', () => {
            const isOpen = hamburgerMobile.classList.toggle('open');
            mobileNav.classList.toggle('open', isOpen);
            document.body.style.overflow = isOpen ? 'hidden' : '';
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && mobileNav) closeMobileNav(); });

    // Navbar scroll
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 60);
        });
    }

    /* ═══════════════════════════════════════════
       ELEMENT REFS
    ═══════════════════════════════════════════ */
    const backButton       = document.getElementById('back-button');
    const nicknameInput    = document.getElementById('nickname');
    const charCount        = document.getElementById('char-count');
    const passwordInput    = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const setupForm        = document.getElementById('setup-form');
    const createBtn        = document.getElementById('create-btn');
    const strengthBar      = document.getElementById('strength-bar');
    const jumpToFormLink   = document.getElementById('jump-to-form-btn');
    const setupFormSection = document.getElementById('setup-form-section');

    /* ═══════════════════════════════════════════
       THEMED TOAST
    ═══════════════════════════════════════════ */
    function showToast(msg, type = 'error') {
        // Use the .pf-toast element in the HTML if present, else create one
        let toast = document.getElementById('pf-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pf-toast';
            toast.style.cssText = [
                'position:fixed', 'top:24px', 'left:50%',
                'transform:translateX(-50%) translateY(-80px)',
                'z-index:9999', 'padding:13px 24px', 'border-radius:100px',
                'font-family:"Cabinet Grotesk",sans-serif',
                'font-size:13px', 'font-weight:700',
                'box-shadow:0 8px 32px rgba(26,21,16,0.18)',
                'transition:transform 0.4s cubic-bezier(0.22,1,0.36,1)',
                'white-space:nowrap', 'pointer-events:none'
            ].join(';');
            document.body.appendChild(toast);
        }

        // Set colour based on type
        if (type === 'success') {
            toast.style.background = '#2d7a4f';
            toast.style.color      = '#fff';
        } else {
            toast.style.background = '#1a1510';
            toast.style.color      = '#f7f6f2';
        }

        toast.textContent = msg;
        // Force reflow so transition fires
        toast.style.transform = 'translateX(-50%) translateY(-80px)';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
        });

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-80px)';
        }, 3800);
    }

    /* ═══════════════════════════════════════════
       PASSWORD RULES
    ═══════════════════════════════════════════ */
    const passwordRules = {
        length:  v => v.length >= 8 && v.length <= 15,
        case:    v => /[a-z]/.test(v) && /[A-Z]/.test(v),
        number:  v => /\d/.test(v),
        special: v => /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(v)
    };

    function isPasswordValid(password) {
        return Object.values(passwordRules).every(rule => rule(password));
    }

    /* ═══════════════════════════════════════════
       BACK BUTTON
    ═══════════════════════════════════════════ */
    if (backButton) {
        backButton.addEventListener('click', function () {
            window.history.back();
        });
    }

    if (jumpToFormLink && setupFormSection) {
        jumpToFormLink.addEventListener('click', function (e) {
            e.preventDefault();
            setupFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    /* ═══════════════════════════════════════════
       NICKNAME CHAR COUNT
    ═══════════════════════════════════════════ */
    if (nicknameInput && charCount) {
        nicknameInput.addEventListener('input', function () {
            charCount.textContent = this.value.length;
        });
    }

    /* ═══════════════════════════════════════════
       TOGGLE PASSWORD VISIBILITY
    ═══════════════════════════════════════════ */
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const isHidden = passwordInput.type === 'password';
            passwordInput.type  = isHidden ? 'text' : 'password';
            this.textContent    = isHidden ? '🙈' : '👁';
        });
    }

    /* ═══════════════════════════════════════════
       PASSWORD REQUIREMENTS + STRENGTH BAR
    ═══════════════════════════════════════════ */
    const strengthColours = ['#e74c3c', '#e67e22', '#f1c40f', '#2d7a4f'];

    function updateRequirement(id, met) {
        const el = document.getElementById(id);
        if (!el) return;
        const icon = el.querySelector('.requirement-icon');
        if (met) {
            el.classList.add('met');
            if (icon) icon.textContent = '✓';
        } else {
            el.classList.remove('met');
            if (icon) icon.textContent = '○';
        }
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            const val = this.value;

            // Update individual requirement indicators
            updateRequirement('req-length',  passwordRules.length(val));
            updateRequirement('req-case',    passwordRules.case(val));
            updateRequirement('req-number',  passwordRules.number(val));
            updateRequirement('req-special', passwordRules.special(val));

            // Update strength bar
            if (strengthBar) {
                const score = Object.values(passwordRules).filter(r => r(val)).length;
                strengthBar.style.width      = (score * 25) + '%';
                strengthBar.style.background = strengthColours[Math.max(score - 1, 0)];
            }
        });
    }

    /* ═══════════════════════════════════════════
       FORM SUBMIT
    ═══════════════════════════════════════════ */
    if (setupForm) {
        setupForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const password = document.getElementById('password').value;

            // Validate password before sending
            if (!isPasswordValid(password)) {
                showToast(
                    'Password must be 8–15 chars with upper/lowercase, a number, and a special character.',
                    'error'
                );
                return;
            }

            // Collect form data
            const accountType = setupForm.dataset.accountType;
            const formData = {
                account_type: accountType,
                currency:     document.getElementById('currency').value,
                nickname:     document.getElementById('nickname').value,
                leverage:     document.getElementById('leverage').value,
                platform:     document.getElementById('platform').value,
                password:     password
            };

            // Validate all fields are filled
            for (const [key, value] of Object.entries(formData)) {
                if (!value) {
                    const label = key.replace('_', ' ');
                    showToast(`Please fill in: ${label}`, 'error');
                    return;
                }
            }

            // Show loading state
            if (createBtn) {
                createBtn.disabled    = true;
                createBtn.textContent = 'Creating…';
                createBtn.classList.add('loading');
            }

            fetch('/api/account-setup', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(formData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showToast('Account created! Redirecting…', 'success');
                    if (createBtn) {
                        createBtn.textContent = '✓ Created';
                        createBtn.classList.remove('loading');
                    }
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 900);
                } else {
                    showToast(data.message || 'Failed to create account', 'error');
                    // Re-enable button
                    if (createBtn) {
                        createBtn.disabled    = false;
                        createBtn.textContent = 'Create account';
                        createBtn.classList.remove('loading');
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('A network error occurred. Please try again.', 'error');
                if (createBtn) {
                    createBtn.disabled    = false;
                    createBtn.textContent = 'Create account';
                    createBtn.classList.remove('loading');
                }
            });
        });
    }

    /* ═══════════════════════════════════════════
       PROFILE DROPDOWN (carried over from accounts.js pattern)
    ═══════════════════════════════════════════ */
    const profileToggle   = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', function (e) {
        const wrapper = document.querySelector('.user-profile-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            profileDropdown?.classList.remove('active');
        }
    });

    /* ═══════════════════════════════════════════
       MEMBER SINCE (profile card)
    ═══════════════════════════════════════════ */
    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl) {
        const userCreatedAt = document.querySelector('[data-user-created-at]')
            ?.getAttribute('data-user-created-at');
        if (userCreatedAt) {
            memberSinceEl.textContent = formatMemberSince(userCreatedAt);
        }
    }

    /* ═══════════════════════════════════════════
       LIVE CLOCK (profile card)
    ═══════════════════════════════════════════ */
    function updateTime() {
        const now     = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour:   '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        const timeEl = document.getElementById('current-time');
        if (timeEl) timeEl.textContent = timeStr;
    }
    updateTime();
    setInterval(updateTime, 1000);

});

/* ═══════════════════════════════════════════
   HELPERS (outside DOMContentLoaded so they
   can be called from inline onclick attrs too)
═══════════════════════════════════════════ */
function closeMobileNav() {
    const hamburger = document.getElementById('hamburger');
    const hamburgerMobile = document.getElementById('hamburger-mobile');
    const mobileNav = document.getElementById('mobileNav');
    if (hamburger) hamburger.classList.remove('open');
    if (hamburgerMobile) hamburgerMobile.classList.remove('open');
    if (mobileNav) mobileNav.classList.remove('open');
    document.body.style.overflow = '';
}

function formatMemberSince(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function editName() {
    document.getElementById('name-display').style.display = 'none';
    document.getElementById('name-edit').style.display    = 'flex';
    document.getElementById('name-input').focus();
}

function cancelEdit() {
    document.getElementById('name-display').style.display = 'flex';
    document.getElementById('name-edit').style.display    = 'none';
}

async function saveName() {
    const newName = document.getElementById('name-input').value.trim();
    if (!newName) return;

    try {
        const response = await fetch('/api/update-name', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name: newName })
        });
        const data = await response.json();

        if (data.success) {
            document.getElementById('profile-name-text').textContent         = newName;
            document.querySelector('.profile-card-avatar').textContent        = newName[0].toUpperCase();
            document.querySelector('.profile-icon').textContent               = newName[0].toUpperCase();
            cancelEdit();
        }
    } catch (error) {
        console.error('Error updating name:', error);
    }
}
