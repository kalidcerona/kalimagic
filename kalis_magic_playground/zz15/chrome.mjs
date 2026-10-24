import { $ } from './dom.mjs';
import { sizeCanvas } from './detect.mjs';

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  const landscape = w > h;
  document.body.classList.toggle('landscape', landscape);
  const chrome = $('chrome');
  const cw = landscape ? h : w, ch = landscape ? w : h;
  chrome.style.width = cw + 'px';
  chrome.style.height = ch + 'px';
  chrome.style.transform = landscape ? `translateY(${h}px) rotate(-90deg)` : 'none';
  chrome.style.setProperty('--u', (cw / 923) + 'px');
  // The feed stays level with the screen: counter-rotate it inside the turned viewfinder.
  const vf = $('vf'), feed = $('feed');
  if (landscape) {
    const vw = vf.clientWidth, vh = vf.clientHeight;
    feed.style.width = vh + 'px'; feed.style.height = vw + 'px';
    feed.style.left = (vw - vh) / 2 + 'px'; feed.style.top = (vh - vw) / 2 + 'px';
    feed.style.transform = 'rotate(90deg)';
  } else {
    feed.style.cssText = '';
  }
  sizeCanvas();
}
window.addEventListener('resize', layout);
screen.orientation?.addEventListener?.('change', () => setTimeout(layout, 50));

$('shutter').addEventListener('click', () => {
  const f = $('flash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
});

export {
  layout,
};
