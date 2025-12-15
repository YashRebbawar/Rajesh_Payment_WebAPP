function formatMemberSince(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function initMemberSince() {
    const memberSinceEl = document.getElementById('member-since');
    if (memberSinceEl) {
        const userCreatedAt = document.querySelector('[data-user-created-at]')?.getAttribute('data-user-created-at');
        if (userCreatedAt) {
            memberSinceEl.textContent = formatMemberSince(userCreatedAt);
        }
    }
}

document.addEventListener('DOMContentLoaded', initMemberSince);
