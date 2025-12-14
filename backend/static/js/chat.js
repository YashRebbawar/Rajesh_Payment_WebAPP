let currentChatUserId = null;
let currentUserId = null;
let unreadMessages = {};

function openChatModal(userId, userName) {
    console.log('Opening chat for user:', userId, userName);
    currentChatUserId = userId;
    const modal = document.getElementById('chat-modal');
    console.log('Modal element:', modal);
    if (!modal) {
        console.error('Chat modal not found');
        return;
    }
    const header = modal.querySelector('.chat-header h3');
    if (header) {
        header.textContent = `Chat with ${userName}`;
    }
    modal.classList.add('active');
    console.log('Modal active class added, classList:', modal.classList);
    unreadMessages[userId] = 0;
    removeChatBadge(userId);
    loadChatMessages();
}

function closeChatModal() {
    const modal = document.getElementById('chat-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    currentChatUserId = null;
}

function loadChatMessages() {
    if (!currentChatUserId) return;
    
    fetch(`/api/chat/messages/${currentChatUserId}`)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.success) {
                displayMessages(data.messages);
            } else {
                console.error('Failed to load messages:', data.message);
            }
        })
        .catch(err => console.error('Error loading messages:', err));
}

function displayMessages(messages) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    if (!Array.isArray(messages)) {
        console.error('Invalid messages format');
        messagesContainer.innerHTML = '<div class="chat-empty">Error loading messages</div>';
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="chat-empty">No messages yet. Start the conversation!</div>';
        return;
    }
    
    messages.forEach(msg => {
        try {
            if (!msg.sender_id || !msg.message || !msg.created_at) {
                console.warn('Invalid message object:', msg);
                return;
            }
            const isOwn = msg.sender_id === currentUserId;
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message ${isOwn ? 'sent' : 'received'}`;
            
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageDiv.innerHTML = `
                <div>
                    <div class="message-bubble ${isOwn ? 'sent' : 'received'}">${escapeHtml(msg.message)}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
            messagesContainer.appendChild(messageDiv);
        } catch (err) {
            console.error('Error rendering message:', err, msg);
        }
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) {
        console.warn('Empty message');
        return;
    }
    
    if (!currentChatUserId) {
        console.error('No chat user selected');
        return;
    }
    
    const btn = document.querySelector('.chat-send-btn');
    if (!btn) {
        console.error('Send button not found');
        return;
    }
    
    btn.disabled = true;
    
    fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentChatUserId, message: message })
    })
    .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.success) {
            input.value = '';
            loadChatMessages();
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

function showChatBadge(userId) {
    const buttons = document.querySelectorAll('.chat-icon-btn');
    buttons.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(userId)) {
            let badge = btn.querySelector('.chat-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'chat-badge';
                badge.textContent = '1';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            } else {
                badge.textContent = (parseInt(badge.textContent) + 1);
            }
        }
    });
}

function removeChatBadge(userId) {
    const buttons = document.querySelectorAll('.chat-icon-btn');
    buttons.forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(userId)) {
            const badge = btn.querySelector('.chat-badge');
            if (badge) badge.remove();
        }
    });
}

function pollNewMessages() {
    if (!currentChatUserId) {
        fetch('/api/chat/unread-count')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.unread_users) {
                    data.unread_users.forEach(userId => {
                        showChatBadge(userId);
                    });
                }
            })
            .catch(err => console.error('Error polling messages:', err));
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('chat-modal');
    
    if (modal) {
        const closeBtn = modal.querySelector('.chat-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeChatModal);
        }
        
        const input = document.getElementById('chat-input');
        const sendBtn = document.querySelector('.chat-send-btn');
        
        if (input && sendBtn) {
            sendBtn.addEventListener('click', sendChatMessage);
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
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
                closeChatModal();
            }
        });
        
        setInterval(pollNewMessages, 5000);
    }
});
