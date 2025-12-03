function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = timeStr;
}
updateTime();
setInterval(updateTime, 60000);

document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.account-card');
    const actionSection = document.getElementById('action-section');
    const openButton = document.getElementById('open-button');
    const backButton = document.getElementById('back-button');
    let selectedCard = null;

    cards.forEach(card => {
        card.addEventListener('click', function() {
            cards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedCard = this;
            
            const accountType = this.querySelector('h2').textContent;
            openButton.textContent = `Open ${accountType} Account`;
            actionSection.style.display = 'block';
        });
    });

    openButton.addEventListener('click', function() {
        if (selectedCard) {
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
