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

const memberSinceEl = document.getElementById('member-since');
if (memberSinceEl) {
    const userCreatedAt = document.querySelector('[data-user-created-at]')?.getAttribute('data-user-created-at');
    if (userCreatedAt) {
        memberSinceEl.textContent = formatMemberSince(userCreatedAt);
    }
}

document.getElementById('profile-toggle')?.addEventListener('click', function() {
    const dropdown = document.getElementById('profile-dropdown');
    dropdown.classList.toggle('active');
});

document.addEventListener('click', function(e) {
    const wrapper = document.querySelector('.user-profile-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        document.getElementById('profile-dropdown')?.classList.remove('active');
    }
});

function showStatus(message, type = 'success') {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 4000);
}

const params = new URLSearchParams(window.location.search);
if (params.get('status') === 'registered') {
    showStatus('✓ Registration successful! Welcome!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
} else if (params.get('status') === 'loggedin') {
    showStatus('✓ Logged in successfully!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
} else if (params.get('status') === 'loggedout') {
    showStatus('✓ You have been logged out successfully!', 'success');
    window.history.replaceState({}, document.title, window.location.pathname);
}

const watchDemoBtn = document.getElementById('watch-demo-btn');
const demoModal = document.getElementById('demo-modal');
const demoBackdrop = document.getElementById('demo-backdrop');
const demoClose = document.getElementById('demo-close');

function openDemo() {
    demoModal?.classList.add('active');
    document.body.classList.add('no-scroll');
}
function closeDemo() {
    demoModal?.classList.remove('active');
    document.body.classList.remove('no-scroll');
}

watchDemoBtn?.addEventListener('click', openDemo);
demoBackdrop?.addEventListener('click', closeDemo);
demoClose?.addEventListener('click', closeDemo);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && demoModal?.classList.contains('active')) {
        closeDemo();
    }
});

const hamburgerBtn = document.getElementById('hamburger-btn');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
        hamburgerBtn.classList.toggle('active');
        mobileMenu?.classList.toggle('active');
    });
}

document.addEventListener('click', (e) => {
    if (hamburgerBtn && mobileMenu && !hamburgerBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
        hamburgerBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
    }
});
