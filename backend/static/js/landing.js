function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 60000);

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
    if (!newName) {
        showStatus('Name cannot be empty', 'error');
        return;
    }
    
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
            showStatus('✓ Name updated successfully!', 'success');
        } else {
            showStatus(data.message || 'Failed to update name', 'error');
        }
    } catch (error) {
        showStatus('Error updating name', 'error');
    }
}
