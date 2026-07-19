(function(){
  function targetClass(el){
    return el.classList.contains('fade-in') ? 'visible' : 'kx-in';
  }
  // 스태거 자식마다 --kx-i 부여 (nth-child 하드코딩 대신 CSS 변수 방식, 자식 개수 무관)
  function indexKids(list){
    Array.prototype.forEach.call(list, function(c, i){ c.style.setProperty('--kx-i', i); });
  }
  // 단일 리빌 대상에 대해 스태거 인덱스 부여 (리빌 직전 호출 → 동적 주입된 자식도 포함)
  function assignStaggerFor(el){
    if (el.classList && el.classList.contains('kx-fade')){
      indexKids(el.children);
    }
    indexKids(el.querySelectorAll ? el.querySelectorAll('figure') : []);
    if (el.querySelectorAll){
      el.querySelectorAll('.kx-thread').forEach(function(t){ indexKids(t.children); });
    }
  }
  function assignStagger(){
    document.querySelectorAll('.kx-desktop .kx-fade').forEach(function(el){ indexKids(el.children); });
    document.querySelectorAll('.kx-mobile .kx-shell > div').forEach(assignStaggerFor);
  }
  window.PgReveal = window.PgReveal || {};
  window.PgReveal.assignStagger = assignStagger;
  function setupReveal(){
    if (window.__pgRevealDone) return;
    window.__pgRevealDone = true;
    assignStagger();
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
        if (e.isIntersecting){ assignStaggerFor(e.target); e.target.classList.add(targetClass(e.target)); io.unobserve(e.target); }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -8% 0px' });
    nodes.forEach(function(el){
      if (el.dataset.pgRevealObserved) return; // 중복 관찰 방지 가드
      el.dataset.pgRevealObserved = '1';
      io.observe(el);
    });
  }
  window.PgReveal.init = setupReveal;
  if (document.readyState !== 'loading') setupReveal();
  else document.addEventListener('DOMContentLoaded', setupReveal);
})();
