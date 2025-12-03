function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 60000);

document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
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

    const accountsList = document.querySelector('.accounts-list');
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            if (accountsList) {
                accountsList.className = view === 'grid' ? 'accounts-grid' : 'accounts-list';
            }
        });
    });

    document.querySelectorAll('.deposit-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const accountId = this.getAttribute('data-account-id');
            window.location.href = '/payment/' + accountId;
        });
    });

    document.querySelectorAll('.withdraw-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            alert('Withdraw functionality coming soon!');
        });
    });
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
