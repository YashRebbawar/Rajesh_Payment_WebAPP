document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const shouldOpen = body?.dataset.showTestimonialPrompt === 'true';
    const isEligibleUser = body?.dataset.userAuthenticated === 'true';
    const modal = document.getElementById('testimonial-modal-shell');

    if (!modal || !isEligibleUser) return;

    const promptView = document.getElementById('testimonial-prompt-view');
    const formView = document.getElementById('testimonial-form-view');
    const successView = document.getElementById('testimonial-success-view');
    const form = document.getElementById('testimonial-form');
    const openFormBtn = document.getElementById('open-testimonial-form');
    const laterBtn = document.getElementById('testimonial-later-btn');
    const backBtn = document.getElementById('testimonial-back-btn');
    const closeButtons = modal.querySelectorAll('[data-close-testimonial]');
    const ratingInput = document.getElementById('testimonial-rating');
    const stars = Array.from(modal.querySelectorAll('.testimonial-star'));
    const submitBtn = document.getElementById('testimonial-submit-btn');
    const nameInput = document.getElementById('testimonial-name');
    const cityInput = document.getElementById('testimonial-city');
    const commentInput = document.getElementById('testimonial-comment');

    function setOpenState(isOpen) {
        modal.classList.toggle('is-open', isOpen);
        modal.setAttribute('aria-hidden', String(!isOpen));
        body.classList.toggle('testimonial-modal-open', isOpen);
    }

    function showPromptView() {
        promptView.hidden = false;
        formView.hidden = true;
        if (form) form.hidden = false;
        successView.hidden = true;
    }

    function showFormView() {
        promptView.hidden = true;
        formView.hidden = false;
        if (form) form.hidden = false;
        successView.hidden = true;
        setTimeout(() => nameInput?.focus(), 80);
    }

    function showSuccessView() {
        promptView.hidden = true;
        formView.hidden = false;
        if (form) form.hidden = true;
        successView.hidden = false;
    }

    function setError(field, message) {
        const target = modal.querySelector(`[data-error-for="${field}"]`);
        if (target) target.textContent = message || '';
    }

    function clearErrors() {
        ['name', 'city', 'rating', 'comment'].forEach((field) => setError(field, ''));
    }

    function paintStars(hoverRating = 0) {
        const selectedRating = Number(ratingInput.value || 0);
        const activeRating = hoverRating || selectedRating;

        stars.forEach((star) => {
            const starRating = Number(star.dataset.rating);
            const isActive = starRating <= activeRating;
            star.classList.toggle('is-active', isActive);
            star.classList.toggle('is-locked', starRating <= selectedRating);
        });
    }

    function validate() {
        const payload = {
            name: nameInput.value.trim(),
            city: cityInput.value.trim(),
            rating: Number(ratingInput.value || 0),
            comment: commentInput.value.trim()
        };
        let valid = true;

        clearErrors();

        if (!payload.name) {
            setError('name', 'Please enter your name.');
            valid = false;
        }
        if (!payload.city) {
            setError('city', 'Please enter your city.');
            valid = false;
        }
        if (!payload.rating) {
            setError('rating', 'Please select a star rating.');
            valid = false;
        }
        if (!payload.comment) {
            setError('comment', 'Please share your feedback.');
            valid = false;
        } else if (payload.comment.length < 15) {
            setError('comment', 'Feedback should be at least 15 characters.');
            valid = false;
        }

        return { valid, payload };
    }

    function setSubmittingState(isSubmitting) {
        submitBtn?.classList.toggle('is-loading', isSubmitting);
        if (submitBtn) submitBtn.disabled = isSubmitting;
    }

    openFormBtn?.addEventListener('click', showFormView);
    backBtn?.addEventListener('click', showPromptView);
    laterBtn?.addEventListener('click', () => setOpenState(false));

    closeButtons.forEach((button) => {
        button.addEventListener('click', () => setOpenState(false));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            setOpenState(false);
        }
    });

    stars.forEach((star) => {
        star.addEventListener('mouseenter', () => paintStars(Number(star.dataset.rating)));
        star.addEventListener('mouseleave', () => paintStars());
        star.addEventListener('click', () => {
            ratingInput.value = star.dataset.rating;
            setError('rating', '');
            paintStars();
        });
    });

    [nameInput, cityInput, commentInput].forEach((input) => {
        input?.addEventListener('input', () => {
            const field = input.name;
            if (input.value.trim()) {
                setError(field, '');
            }
        });
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { valid, payload } = validate();
        if (!valid) return;

        setSubmittingState(true);
        try {
            const response = await fetch('/api/testimonials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                setError('comment', result.message || 'Unable to submit testimonial.');
                return;
            }

            showSuccessView();
            setTimeout(() => setOpenState(false), 1800);
        } catch (error) {
            setError('comment', 'Connection error. Please try again.');
        } finally {
            setSubmittingState(false);
        }
    });

    paintStars();
    showPromptView();

    if (shouldOpen) {
        setTimeout(() => setOpenState(true), 500);
    }
});
