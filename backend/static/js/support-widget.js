document.addEventListener('DOMContentLoaded', function() {
    const widget = document.getElementById('support-widget');
    
    if (!widget) {
        const supportWidget = document.createElement('div');
        supportWidget.id = 'support-widget';
        supportWidget.className = 'support-widget';
        supportWidget.innerHTML = `
            <button class="support-widget-btn" onclick="openUserChatModal()">
                <img src="/static/images/support-icon.png" alt="Support" class="support-icon-img" width="20" height="20">
                <span>Support</span>
            </button>
        `;
        document.body.appendChild(supportWidget);
    }
});
