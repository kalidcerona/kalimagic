// kalimagic v2 — 스크롤 fade-in
document.addEventListener('DOMContentLoaded', () => {
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
