// kalimagic v2 공통 헤더 — 6페이지(홈·작품·영상·입문·후기·레슨)
// head에서 동기 로드되므로 즉시 js-anim 플래그를 단다 → JS 꺼지면 .fade-in이 그냥 보임(progressive enhancement)
document.documentElement.classList.add('js-anim');

function renderNav(activePage) {
    const pages = [
        { key: 'home',   label: '홈',   href: 'index.html' },
        { key: 'works',  label: '작품', href: 'works.html' },
        { key: 'video',  label: '영상', href: 'video.html' },
        { key: 'intro',  label: '입문', href: 'intro.html' },
        { key: 'reviews', label: '후기', href: 'reviews.html' },
        { key: 'lesson', label: '레슨', href: 'lesson.html', cta: true },
    ];

    const links = pages.map(({ key, label, href, cta }) => {
        const cls = ['nav-link', cta && 'nav-cta', key === activePage && 'active']
            .filter(Boolean).join(' ');
        return `<a href="${href}" class="${cls}">${label}</a>`;
    }).join('');

    const root = document.getElementById('nav-root');
    if (!root) return;  // nav-root 없는 페이지에서 null deref 가드
    root.className = 'main-nav';
    root.innerHTML = `<a href="index.html" class="nav-logo">KALI</a><nav class="nav-links">${links}</nav>`;
}
