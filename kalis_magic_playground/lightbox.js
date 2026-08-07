(function () {
    'use strict';

    var activeOverlay = null;
    var previousBodyOverflow = '';
    var albumTitle = '';
    var albumImages = [];
    var albumReviews = [];

    function injectStyles() {
        if (document.getElementById('kx-lightbox-style')) return;

        var style = document.createElement('style');
        style.id = 'kx-lightbox-style';
        style.textContent = [
            '.kx-lightbox-overlay {',
            '    position: fixed; inset: 0; z-index: 9999;',
            '    display: flex; align-items: center; justify-content: center;',
            '    padding: 28px; background: rgba(0, 0, 0, .92);',
            '    opacity: 0; transition: opacity 180ms ease;',
            '    overflow: auto; color: #fff;',
            '}',
            '.kx-lightbox-overlay.is-open { opacity: 1; }',
            '.kx-lightbox-shell {',
            '    width: min(1120px, 100%);',
            '    display: flex; flex-direction: column; gap: 22px;',
            '}',
            '.kx-lightbox-header {',
            '    display: flex; align-items: center; justify-content: space-between; gap: 16px;',
            '    position: sticky; top: 0; z-index: 1;',
            '    padding: 4px 0 10px; background: linear-gradient(rgba(0, 0, 0, .92), rgba(0, 0, 0, .72));',
            '}',
            '.kx-lightbox-title {',
            '    margin: 0; font-size: clamp(20px, 3vw, 34px); line-height: 1.2; font-weight: 800;',
            '}',
            '.kx-lightbox-actions {',
            '    display: flex; align-items: center; gap: 10px; flex: 0 0 auto;',
            '}',
            '.kx-lightbox-button {',
            '    width: 44px; height: 44px; border: 1px solid rgba(255, 255, 255, .35);',
            '    border-radius: 999px; background: rgba(0, 0, 0, .35); color: #fff;',
            '    font-size: 28px; line-height: 1; cursor: pointer;',
            '    display: inline-flex; align-items: center; justify-content: center;',
            '}',
            '.kx-lightbox-button:hover, .kx-lightbox-button:focus-visible {',
            '    background: rgba(255, 255, 255, .14); outline: none;',
            '}',
            '.kx-lightbox-grid {',
            '    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));',
            '    gap: 14px; padding-bottom: 24px;',
            '}',
            '.kx-lightbox-thumb {',
            '    display: block; width: 100%; aspect-ratio: 4 / 3;',
            '    border: 0; padding: 0; border-radius: 8px; overflow: hidden;',
            '    background: rgba(255, 255, 255, .08); cursor: zoom-in;',
            '}',
            '.kx-lightbox-thumb img {',
            '    display: block; width: 100%; height: 100%; object-fit: cover;',
            '}',
            '.kx-lightbox-reviews {',
            '    grid-column: 1 / -1; margin-top: 18px; padding-top: 22px;',
            '    border-top: 1px solid rgba(255, 255, 255, .18);',
            '    display: flex; flex-direction: column; gap: 18px;',
            '}',
            '.kx-lightbox-review p {',
            '    margin: 0 0 6px; color: #f1e9df; font-size: 0.98rem; line-height: 1.7;',
            '}',
            '.kx-lightbox-review span {',
            '    color: #e0904e; font-size: 0.82rem; font-weight: 800;',
            '}',
            '.kx-lightbox-viewer {',
            '    flex: 1; min-height: 0;',
            '    display: flex; align-items: center; justify-content: center;',
            '    padding: 0 0 24px;',
            '}',
            '.kx-lightbox-image {',
            '    display: block; max-width: 100%; max-height: calc(100vh - 130px);',
            '    width: auto; height: auto; object-fit: contain;',
            '    box-shadow: 0 24px 80px rgba(0, 0, 0, .5);',
            '}',
            '.kx-lightbox-back[hidden] { display: none; }',
            '@media (max-width: 640px) {',
            '    .kx-lightbox-overlay { padding: 18px 12px; }',
            '    .kx-lightbox-shell { gap: 14px; }',
            '    .kx-lightbox-header { gap: 10px; }',
            '    .kx-lightbox-title { font-size: 20px; }',
            '    .kx-lightbox-button { width: 40px; height: 40px; font-size: 26px; }',
            '    .kx-lightbox-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }',
            '    .kx-lightbox-image { max-height: calc(100vh - 112px); }',
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

    function imageData(image) {
        return {
            src: image.currentSrc || image.src,
            alt: image.alt || ''
        };
    }

    function renderAlbum() {
        if (!activeOverlay) return;

        var title = activeOverlay.querySelector('.kx-lightbox-title');
        var backButton = activeOverlay.querySelector('.kx-lightbox-back');
        var content = activeOverlay.querySelector('.kx-lightbox-content');

        title.textContent = albumTitle;
        backButton.hidden = true;
        content.className = 'kx-lightbox-content kx-lightbox-grid';
        content.innerHTML = '';

        albumImages.forEach(function (item, index) {
            var button = document.createElement('button');
            button.className = 'kx-lightbox-thumb';
            button.type = 'button';
            button.setAttribute('aria-label', item.alt || '앨범 사진 ' + (index + 1) + ' 크게 보기');

            var image = document.createElement('img');
            image.src = item.src;
            image.alt = item.alt;
            image.decoding = 'async';
            image.loading = 'lazy';

            button.appendChild(image);
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                renderViewer(index);
            });
            content.appendChild(button);
        });

        if (albumReviews.length > 0) {
            var reviewsWrap = document.createElement('div');
            reviewsWrap.className = 'kx-lightbox-reviews';
            albumReviews.forEach(function (r) {
                var item = document.createElement('div');
                item.className = 'kx-lightbox-review';
                var quote = document.createElement('p');
                quote.textContent = r.quote;
                var label = document.createElement('span');
                label.textContent = r.label;
                item.appendChild(quote);
                item.appendChild(label);
                reviewsWrap.appendChild(item);
            });
            content.appendChild(reviewsWrap);
        }
    }

    function renderViewer(index) {
        if (!activeOverlay || !albumImages[index]) return;

        var item = albumImages[index];
        var title = activeOverlay.querySelector('.kx-lightbox-title');
        var backButton = activeOverlay.querySelector('.kx-lightbox-back');
        var content = activeOverlay.querySelector('.kx-lightbox-content');

        title.textContent = albumTitle;
        backButton.hidden = false;
        content.className = 'kx-lightbox-content kx-lightbox-viewer';
        content.innerHTML = '';

        var image = document.createElement('img');
        image.className = 'kx-lightbox-image';
        image.src = item.src;
        image.alt = item.alt;
        image.decoding = 'async';
        content.appendChild(image);
        backButton.focus({ preventScroll: true });
    }

    function createOverlay() {
        var overlay = document.createElement('div');
        overlay.className = 'kx-lightbox-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', '행사 앨범 보기');

        var shell = document.createElement('div');
        shell.className = 'kx-lightbox-shell';

        var header = document.createElement('div');
        header.className = 'kx-lightbox-header';

        var title = document.createElement('h2');
        title.className = 'kx-lightbox-title';

        var actions = document.createElement('div');
        actions.className = 'kx-lightbox-actions';

        var backButton = document.createElement('button');
        backButton.className = 'kx-lightbox-button kx-lightbox-back';
        backButton.type = 'button';
        backButton.hidden = true;
        backButton.setAttribute('aria-label', '앨범으로 돌아가기');
        backButton.textContent = '←';

        var closeButton = document.createElement('button');
        closeButton.className = 'kx-lightbox-button kx-lightbox-close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', '닫기');
        closeButton.textContent = '×';

        var content = document.createElement('div');
        content.className = 'kx-lightbox-content';

        actions.appendChild(backButton);
        actions.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(actions);
        shell.appendChild(header);
        shell.appendChild(content);
        overlay.appendChild(shell);

        backButton.addEventListener('click', function (event) {
            event.stopPropagation();
            renderAlbum();
        });
        closeButton.addEventListener('click', closeLightbox);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeLightbox();
        });

        return overlay;
    }

    function openAlbum(sourceImage) {
        var block = sourceImage.closest('.event-block');
        if (!block) return;

        var title = block.querySelector('.event-block-title');
        var images = Array.prototype.slice.call(block.querySelectorAll('.event-gallery figure img'));
        if (!images.length) return;

        closeLightbox();
        injectStyles();

        if (title) {
            var titleClone = title.cloneNode(true);
            var countEl = titleClone.querySelector('.ev-count');
            if (countEl) countEl.parentNode.removeChild(countEl);
            albumTitle = titleClone.textContent.trim();
        } else {
            albumTitle = '행사 앨범';
        }
        albumImages = images.map(imageData);
        var reviewCards = Array.prototype.slice.call(block.querySelectorAll('.event-reviews-data .event-review-card'));
        albumReviews = reviewCards.map(function (card) {
            var p = card.querySelector('p');
            var s = card.querySelector('span');
            return { quote: p ? p.textContent : '', label: s ? s.textContent : '' };
        });

        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        var overlay = createOverlay();
        activeOverlay = overlay;
        document.body.appendChild(overlay);
        renderAlbum();

        window.requestAnimationFrame(function () {
            if (activeOverlay !== overlay) return;
            overlay.classList.add('is-open');
            overlay.querySelector('.kx-lightbox-close').focus({ preventScroll: true });
        });
    }

    function onGalleryClick(event) {
        var figure = event.target.closest('.event-gallery figure');
        if (!figure) return;
        var image = figure.querySelector('img');
        if (!image) return;

        event.preventDefault();
        event.stopPropagation();
        openAlbum(image);
    }

    function onKeydown(event) {
        if (!activeOverlay) return;
        if (event.key === 'Escape') {
            closeLightbox();
        }
    }

    function bindGallery() {
        document.querySelectorAll('.event-gallery figure').forEach(function (figure) {
            figure.style.cursor = 'zoom-in';
        });
        document.addEventListener('click', onGalleryClick);
        document.addEventListener('keydown', onKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindGallery);
    } else {
        bindGallery();
    }
})();
