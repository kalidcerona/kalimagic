// kalimagic v2 — reusable collapsible galleries
(function () {
    function getSelector(root, name, fallback) {
        return root.getAttribute(name) || fallback;
    }

    function initCollapsible(root) {
        var itemSelector = getSelector(root, 'data-collapsible-item', '.event-block');
        var titleSelector = getSelector(root, 'data-collapsible-title', '.event-block-title');
        var contentSelector = getSelector(root, 'data-collapsible-content', '.event-gallery');
        var childSelector = getSelector(root, 'data-collapsible-child', 'figure');

        root.querySelectorAll(itemSelector).forEach(function (block) {
            var content = block.querySelector(contentSelector);
            var figures = content ? content.querySelectorAll(childSelector) : block.querySelectorAll(childSelector);
            var title = block.querySelector(titleSelector);
            if (!title || figures.length <= 1) return;  // 사진 1장 행사는 토글 없음

            block.classList.add('is-collapsed');

            var count = document.createElement('span');
            count.className = 'ev-count';
            count.textContent = '사진 ' + figures.length + '장';
            title.appendChild(count);

            var badge = document.createElement('span');
            badge.className = 'ev-more';
            badge.textContent = '+' + (figures.length - 1) + '장 더 보기';
            figures[0].appendChild(badge);
        });
    }

    function initAll() {
        document.querySelectorAll('[data-collapsible]').forEach(initCollapsible);
    }

    window.initCollapsible = initCollapsible;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
