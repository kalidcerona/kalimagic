// kalimagic v2 — 스크롤 fade-in: reveal.js로 통합됨 (W6, 2026-07-08)
// .fade-in 처리는 reveal.js가 담당한다. reveal.js가 먼저 로드/실행된 페이지에서는 아무 것도 하지 않는다.
// mmbs.html처럼 reveal.js를 로드하지 않는 페이지를 위해서만, 원본 fade-in 로직을 폴백으로 유지한다.
document.addEventListener('DOMContentLoaded', () => {
    if (window.__pgRevealDone) return; // reveal.js가 이미 처리했으면 가드
    if (window.PgReveal && typeof window.PgReveal.init === 'function') {
        window.PgReveal.init();
        return;
    }
    const els = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window) || !els.length) {
        els.forEach(el => el.classList.add('visible'));
        return;
    }
    const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
});
