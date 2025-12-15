document.addEventListener('DOMContentLoaded', function() {
    const pendingToggle = document.getElementById('pending-toggle');
    const pendingDetails = document.getElementById('pending-details');
    const pendingDropdown = document.getElementById('pending-status-dropdown');
    
    if (pendingToggle && pendingDetails) {
        pendingToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            pendingDetails.classList.toggle('active');
            if (pendingDropdown) pendingDropdown.classList.toggle('active');
        });
    }
    
    document.addEventListener('click', function(e) {
        if (!document.querySelector('.pending-dropdown-wrapper')?.contains(e.target)) {
            if (pendingDropdown) pendingDropdown.classList.remove('active');
            if (pendingDetails) pendingDetails.classList.remove('active');
        }
    });
});
