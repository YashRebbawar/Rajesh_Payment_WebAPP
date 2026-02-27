// ─── Hamburger menu ──────────────────────────────────────────
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

function closeMobileNav() {
  if (hamburger && mobileNav) {
    hamburger.classList.remove('open');
    mobileNav.classList.remove('open');
    document.body.style.overflow = '';
  }
}

if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

// Close on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileNav(); });

// ─── Navbar scroll ───────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 1000);

function formatMemberSince(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

document.addEventListener('DOMContentLoaded', function() {
    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl) {
        const userCreatedAt = document.querySelector('[data-user-created-at]')?.getAttribute('data-user-created-at');
        if (userCreatedAt) {
            memberSinceEl.textContent = formatMemberSince(userCreatedAt);
        }
    }

    const cards = document.querySelectorAll('.account-card');
    const actionSection = document.getElementById('action-section');
    const openButton = document.getElementById('open-button');
    const backButton = document.getElementById('back-button');
    let selectedCard = null;

    async function checkAccountLimit() {
        try {
            const response = await fetch('/api/account-count');
            const data = await response.json();
            if (data.success && data.count >= data.limit) {
                openButton.disabled = true;
                openButton.textContent = 'Account Limit Reached (3/3)';
                openButton.style.opacity = '0.5';
                openButton.style.cursor = 'not-allowed';
                const note = document.querySelector('.action-note');
                if (note) {
                    note.textContent = 'You have reached the maximum limit of 3 accounts.';
                    note.style.color = '#dc3545';
                }
            }
        } catch (error) {
            console.error('Error checking account limit:', error);
        }
    }
    
    checkAccountLimit();

    cards.forEach(card => {
        card.addEventListener('click', function() {
            cards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedCard = this;
            
            const accountType = this.querySelector('h2').textContent;
            openButton.textContent = `Open ${accountType} Account`;
            actionSection.style.display = 'block';
            
            setTimeout(() => {
                openButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });
    });

    openButton.addEventListener('click', function() {
        if (selectedCard && !openButton.disabled) {
            const accountId = selectedCard.dataset.id;
            window.location.href = `/account-setup/${accountId}`;
        }
    });

    if (backButton) {
        backButton.addEventListener('click', function() {
            window.history.back();
        });
    }

    const profileToggle = document.getElementById('profile-toggle');
    const profileDropdown = document.getElementById('profile-dropdown');
    
    if (profileToggle && profileDropdown) {
        profileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', function(e) {
        const wrapper = document.querySelector('.user-profile-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            profileDropdown?.classList.remove('active');
        }
    });
});

function formatMemberSince(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function editName() {
    document.getElementById('name-display').style.display = 'none';
    document.getElementById('name-edit').style.display = 'flex';
    document.getElementById('name-input').focus();
}

function cancelEdit() {
    document.getElementById('name-display').style.display = 'flex';
    document.getElementById('name-edit').style.display = 'none';
}

async function saveName() {
    const newName = document.getElementById('name-input').value.trim();
    if (!newName) return;
    
    try {
        const response = await fetch('/api/update-name', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newName})
        });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('profile-name-text').textContent = newName;
            document.querySelector('.profile-card-avatar').textContent = newName[0].toUpperCase();
            document.querySelector('.profile-icon').textContent = newName[0].toUpperCase();
            cancelEdit();
        }
    } catch (error) {
        console.error('Error updating name:', error);
    }
}
