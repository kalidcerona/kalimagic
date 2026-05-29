function renderNav(activePage) {
    const pages = [
        { key: 'home',   label: '홈',  href: 'index.html' },
        { key: 'works',  label: '작품', href: 'works.html' },
        { key: 'video',  label: '영상', href: 'video.html' },
        { key: 'intro',  label: '입문', href: 'intro.html' },
        { key: 'lesson', label: '레슨', href: 'lesson.html', cta: true },
    ];

    const links = pages.map(({ key, label, href, cta }) => {
        const cls = ['nav-link', cta && 'nav-cta', key === activePage && 'active']
            .filter(Boolean).join(' ');
        return `<a href="${href}" class="${cls}">${label}</a>`;
    }).join('');

    const root = document.getElementById('nav-root');
    root.className = 'main-nav';
    root.innerHTML = `<a href="index.html" class="nav-logo">KALI</a><nav class="nav-links">${links}</nav>`;
}
