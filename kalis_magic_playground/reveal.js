(function(){
  function setupReveal(){
    var nodes = document.querySelectorAll('.kx-desktop .kx-fade, .kx-mobile .kx-shell > div');
    if (!('IntersectionObserver' in window) || !nodes.length){
      nodes.forEach(function(el){ el.classList.add('kx-in'); });
      return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add('kx-in'); io.unobserve(e.target); }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
    nodes.forEach(function(el){ io.observe(el); });
  }
  if (document.readyState !== 'loading') setupReveal();
  else document.addEventListener('DOMContentLoaded', setupReveal);
})();
