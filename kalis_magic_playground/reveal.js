(function(){
  function targetClass(el){
    return el.classList.contains('fade-in') ? 'visible' : 'kx-in';
  }
  function setupReveal(){
    if (window.__pgRevealDone) return;
    window.__pgRevealDone = true;
    var kxNodes = Array.prototype.slice.call(document.querySelectorAll('.kx-desktop .kx-fade, .kx-mobile .kx-shell > div'));
    var fadeNodes = Array.prototype.slice.call(document.querySelectorAll('.fade-in')).filter(function(el){
      return kxNodes.indexOf(el) === -1;
    });
    var nodes = kxNodes.concat(fadeNodes);
    if (!nodes.length) return;
    if (!('IntersectionObserver' in window)){
      nodes.forEach(function(el){ el.classList.add(targetClass(el)); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add(targetClass(e.target)); io.unobserve(e.target); }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
    nodes.forEach(function(el){
      if (el.dataset.pgRevealObserved) return; // 중복 관찰 방지 가드
      el.dataset.pgRevealObserved = '1';
      io.observe(el);
    });
  }
  window.PgReveal = { init: setupReveal };
  if (document.readyState !== 'loading') setupReveal();
  else document.addEventListener('DOMContentLoaded', setupReveal);
})();
