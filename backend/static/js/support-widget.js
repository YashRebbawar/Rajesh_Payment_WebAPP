function initSupportWidget() {
    const widget = document.createElement('div');
    widget.id = 'support-widget';
    widget.className = 'support-widget';
    widget.innerHTML = `
        <button class="support-widget-btn" onclick="toggleSupportChat(event)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Support</span>
        </button>
    `;
    document.body.appendChild(widget);
    
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('user-chat-modal');
        const widget = document.getElementById('support-widget');
        const btn = document.querySelector('.support-widget-btn');
        
        if (modal && modal.classList.contains('active')) {
            if (!modal.contains(e.target) && !btn.contains(e.target)) {
                closeUserChatModal();
            }
        }
    });
}

function toggleSupportChat(event) {
    event.stopPropagation();
    const modal = document.getElementById('user-chat-modal');
    const widget = document.getElementById('support-widget');
    if (modal) {
        if (modal.classList.contains('active')) {
            modal.classList.remove('active');
            widget.style.display = 'block';
        } else {
            openUserChatModal();
            widget.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', initSupportWidget);
