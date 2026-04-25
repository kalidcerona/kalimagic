// script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Smooth Scrolling for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 2. Intersection Observer for Fade-In Animation
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Trigger when 15% of the element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Stop observing once it has become visible
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Select all elements with the .fade-in class and observe them
    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => {
        observer.observe(el);
    });
    // 3. Lightbox functionality
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const galleryItems = document.querySelectorAll('.gallery-item img');

    if (modal && modalImg) {
        galleryItems.forEach(img => {
            img.addEventListener('click', () => {
                modal.classList.add('active');
                modalImg.src = img.src;
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            });
        });

        modal.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto'; // Restore scrolling
        });
    }
});
