(function () {
    'use strict';

    var selector = '.event-gallery img';
    var activeOverlay = null;
    var previousBodyOverflow = '';

    function injectStyles() {
        if (document.getElementById('kx-lightbox-style')) return;

        var style = document.createElement('style');
        style.id = 'kx-lightbox-style';
        style.textContent = [
            '.kx-lightbox-overlay {',
            '    position: fixed; inset: 0; z-index: 9999;',
            '    display: flex; align-items: center; justify-content: center;',
            '    padding: 48px 24px 28px; background: rgba(0, 0, 0, .9);',
            '    opacity: 0; transition: opacity 180ms ease;',
            '    overflow: hidden; cursor: zoom-out;',
            '}',
            '.kx-lightbox-overlay.is-open { opacity: 1; }',
            '.kx-lightbox-image {',
            '    display: block; max-width: 92vw; max-height: 88vh;',
            '    width: auto; height: auto; object-fit: contain;',
            '    box-shadow: 0 24px 80px rgba(0, 0, 0, .5);',
            '    cursor: zoom-in; transition: transform 180ms ease;',
            '    transform-origin: center center;',
            '}',
            '.kx-lightbox-overlay.is-zoomed {',
            '    align-items: flex-start; justify-content: flex-start;',
            '    overflow: auto; cursor: grab;',
            '}',
            '.kx-lightbox-overlay.is-zoomed .kx-lightbox-image {',
            '    max-width: none; max-height: none;',
            '    margin: max(72px, 8vh) auto max(40px, 6vh);',
            '    transform: scale(2); cursor: zoom-out;',
            '}',
            '.kx-lightbox-close {',
            '    position: fixed; top: 16px; right: 18px; z-index: 1;',
            '    width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, .35);',
            '    border-radius: 999px; background: rgba(0, 0, 0, .5); color: #fff;',
            '    font-size: 30px; line-height: 1; cursor: pointer;',
            '    display: inline-flex; align-items: center; justify-content: center;',
            '}',
            '.kx-lightbox-close:hover, .kx-lightbox-close:focus-visible {',
            '    background: rgba(255, 255, 255, .14); outline: none;',
            '}',
            '@media (max-width: 640px) {',
            '    .kx-lightbox-overlay { padding: 56px 12px 18px; }',
            '    .kx-lightbox-image { max-width: 94vw; max-height: 82vh; }',
            '    .kx-lightbox-overlay.is-zoomed .kx-lightbox-image { transform: scale(1.75); }',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function closeLightbox() {
        if (!activeOverlay) return;

        var overlay = activeOverlay;
        activeOverlay = null;
        document.body.style.overflow = previousBodyOverflow;
        overlay.classList.remove('is-open');

        window.setTimeout(function () {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 180);
    }

    function onKeydown(event) {
        if (event.key === 'Escape') closeLightbox();
    }

    function openLightbox(sourceImage) {
        closeLightbox();
        injectStyles();

        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        var overlay = document.createElement('div');
        overlay.className = 'kx-lightbox-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', sourceImage.alt || '갤러리 이미지 확대 보기');

        var closeButton = document.createElement('button');
        closeButton.className = 'kx-lightbox-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '닫기');
        closeButton.textContent = '×';

        var image = document.createElement('img');
        image.className = 'kx-lightbox-image';
        image.src = sourceImage.currentSrc || sourceImage.src;
        image.alt = sourceImage.alt || '';
        image.decoding = 'async';

        overlay.appendChild(closeButton);
        overlay.appendChild(image);
        document.body.appendChild(overlay);
        activeOverlay = overlay;

        window.requestAnimationFrame(function () {
            overlay.classList.add('is-open');
            closeButton.focus({ preventScroll: true });
        });

        closeButton.addEventListener('click', closeLightbox);

        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeLightbox();
        });

        image.addEventListener('click', function (event) {
            event.stopPropagation();
            overlay.classList.toggle('is-zoomed');
        });
    }

    function bindGalleryImages() {
        document.querySelectorAll(selector).forEach(function (image) {
            image.style.cursor = 'zoom-in';
            image.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                openLightbox(image);
            });
        });

        document.addEventListener('keydown', onKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindGalleryImages);
    } else {
        bindGalleryImages();
    }
})();
