// kalimagic v2 — reusable card-to-modal reviews
(function () {
    function textFrom(card, selector, fallback) {
        var el = selector ? card.querySelector(selector) : null;
        return el ? el.textContent : fallback;
    }

    function initModalCards(root) {
        var cardSelector = root.getAttribute('data-modal-card-selector') || '[data-modal-card]';
        var tagSelector = root.getAttribute('data-modal-tag') || '.field-tag';
        var quoteSelector = root.getAttribute('data-modal-quote') || '.field-quote';
        var authorSelector = root.getAttribute('data-modal-author') || '.field-author';
        var editedSelector = root.getAttribute('data-modal-edited') || '.field-edited';
        var cards = root.querySelectorAll(cardSelector);
        if (!cards.length) return;

        var previousFocus = null;
        var overlay = document.createElement('div');
        overlay.className = 'field-modal-overlay';
        overlay.hidden = true;
        overlay.innerHTML = [
            '<div class="field-modal" role="dialog" aria-modal="true" aria-labelledby="field-modal-title" tabindex="-1">',
                '<button class="field-modal-close" type="button" aria-label="후기 닫기">×</button>',
                '<span class="field-modal-tag" id="field-modal-title"></span>',
                '<p class="field-modal-quote"></p>',
                '<div class="field-modal-footer">',
                    '<span class="field-modal-author"></span>',
                    '<span class="field-modal-edited"></span>',
                '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        var modal = overlay.querySelector('.field-modal');
        var closeBtn = overlay.querySelector('.field-modal-close');
        var modalTag = overlay.querySelector('.field-modal-tag');
        var modalQuote = overlay.querySelector('.field-modal-quote');
        var modalAuthor = overlay.querySelector('.field-modal-author');
        var modalEdited = overlay.querySelector('.field-modal-edited');

        function openModal(card) {
            var quote = card.querySelector(quoteSelector);
            var edited = card.querySelector(editedSelector);
            if (!quote) return;

            previousFocus = document.activeElement;
            modalTag.textContent = textFrom(card, tagSelector, '실전 후기');
            modalQuote.textContent = quote.textContent;
            modalAuthor.textContent = textFrom(card, authorSelector, '');
            modalEdited.textContent = edited ? edited.textContent : '';
            modalEdited.hidden = !edited;
            overlay.hidden = false;
            document.body.classList.add('field-modal-open');
            closeBtn.focus();
        }

        function closeModal() {
            overlay.hidden = true;
            document.body.classList.remove('field-modal-open');
            if (previousFocus && typeof previousFocus.focus === 'function') {
                previousFocus.focus();
            }
        }

        cards.forEach(function (card, index) {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-haspopup', 'dialog');
            card.setAttribute('aria-label', '실전 후기 전문 보기 ' + (index + 1));
            card.addEventListener('click', function () { openModal(card); });
            card.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(card);
                }
            });
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });
        closeBtn.addEventListener('click', closeModal);
        document.addEventListener('keydown', function (e) {
            if (overlay.hidden) return;
            if (e.key === 'Escape') {
                closeModal();
                return;
            }
            if (e.key === 'Tab') {
                var focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusables.length) return;
                var first = focusables[0];
                var last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
    }

    function initAll() {
        document.querySelectorAll('[data-modal]').forEach(initModalCards);
    }

    window.initModalCards = initModalCards;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
