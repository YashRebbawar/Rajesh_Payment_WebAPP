function openUserChatModal() {
    const modal = document.getElementById('user-chat-modal');
    if (modal) {
        modal.classList.add('active');
        loadUserChatMessages();
    }
}

function closeUserChatModal() {
    const modal = document.getElementById('user-chat-modal');
    const widget = document.getElementById('support-widget');
    if (modal) {
        modal.classList.remove('active');
    }
    if (widget) {
        widget.style.display = 'block';
    }
}

function loadUserChatMessages() {
    fetch('/api/chat/user-messages')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                displayUserMessages(data.messages);
            } else {
                console.error('Failed to load messages:', data.message);
            }
        })
        .catch(err => console.error('Error loading messages:', err));
}

function displayUserMessages(messages) {
    const messagesContainer = document.getElementById('user-chat-messages');
    if (!messagesContainer) return;
    
    if (!Array.isArray(messages)) {
        console.error('Invalid messages format');
        messagesContainer.innerHTML = `
        <div class="chat-empty">
            <div class="welcome-content">
                <div class="welcome-emoji">⚠️</div>
                <h3>Oops!</h3>
                <p>Error loading messages. Please try again.</p>
            </div>
        </div>
    `;
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="chat-empty">
                <div class="welcome-content">
                    <div class="welcome-emoji">🙋</div>
                    <h3>Hello! 👋</h3>
                    <p>Send us a message and we'll get back to you shortly</p>
                </div>
            </div>
        `;
        return;
    }
    
    const userId = document.body.dataset.userId;
    messages.forEach(msg => {
        try {
            if (!msg.sender_id || !msg.message || !msg.created_at) {
                console.warn('Invalid message object:', msg);
                return;
            }
            const isOwn = msg.sender_id === userId;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isOwn ? 'sent' : 'received'}`;
            
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = `message-bubble ${isOwn ? 'sent' : 'received'}`;
            bubbleDiv.textContent = msg.message;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            timeDiv.textContent = time;
            
            const wrapper = document.createElement('div');
            wrapper.appendChild(bubbleDiv);
            wrapper.appendChild(timeDiv);
            messageDiv.appendChild(wrapper);
            
            messagesContainer.appendChild(messageDiv);
        } catch (err) {
            console.error('Error rendering message:', err, msg);
        }
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendUserChatMessage() {
    const input = document.getElementById('user-chat-input');
    const message = input.value.trim();
    
    if (!message) {
        console.warn('Empty message');
        return;
    }
    
    const btn = document.querySelector('.user-chat-send-btn');
    if (!btn) {
        console.error('Send button not found');
        return;
    }
    
    btn.disabled = true;
    
    fetch('/api/chat/user-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message })
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            input.value = '';
            loadUserChatMessages();
        } else {
            console.error('Send failed:', data.message);
            alert('Failed to send message: ' + (data.message || 'Unknown error'));
        }
    })
    .catch(err => {
        console.error('Error sending message:', err);
        alert('Error sending message: ' + err.message);
    })
    .finally(() => {
        btn.disabled = false;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('user-chat-modal');
    if (modal) {
        const closeBtn = modal.querySelector('.chat-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeUserChatModal();
            });
        }
        
        const input = document.getElementById('user-chat-input');
        const sendBtn = document.querySelector('.user-chat-send-btn');
        
        if (input && sendBtn) {
            sendBtn.addEventListener('click', sendUserChatMessage);
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendUserChatMessage();
                }
            });
        }
        
        const modalContent = modal.querySelector('.chat-modal-content');
        if (modalContent) {
            modalContent.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeUserChatModal();
            }
        });
    }
});
