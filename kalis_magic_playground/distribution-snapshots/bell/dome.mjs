let release;
export function unpress(dome) {
  clearTimeout(release);
  dome.classList.remove('pressed', 'jammed');
}
export function press(dome, stuck = false) {
  unpress(dome);
  dome.classList.add(stuck ? 'jammed' : 'pressed');
  release = setTimeout(() => unpress(dome), 90);
}

export function createScene(stage) {
  const base = stage.querySelector('.base');
  const card = document.createElement('span');
  card.className = 'folded-card';
  card.setAttribute('aria-hidden', 'true');
  base.prepend(card);
  const dome = base.querySelector('.dome');
  let scale = 1, offsetX = 0, offsetY = 0;
  function zoomCard(pair, ratio, midX, midY) {
    if (!pair.view) {
      const box = card.getBoundingClientRect();
      pair.view = { left: box.left, top: box.top, scale, offsetX, offsetY };
    }
    const view = pair.view;
    scale = Math.min(3, Math.max(1, view.scale * ratio));
    const factor = scale / view.scale;
    offsetX = scale === 1 ? 0 : view.offsetX + midX - pair.midX + (pair.midX - view.left) * (1 - factor);
    offsetY = scale === 1 ? 0 : view.offsetY + midY - pair.midY + (pair.midY - view.top) * (1 - factor);
    draw('open');
  }
  function draw(phase, { angle = 0, innerTurn, dx = 0, dy = 0, second = stage.dataset.reveal === 'second' } = {}) {
    const reveal = second ? 'second' : 'first';
    if (phase === 'normal' || reveal !== stage.dataset.reveal) { scale = 1; offsetX = offsetY = 0; }
    stage.dataset.reveal = reveal;
    const item = second ? stage.dataset.secondItem : stage.dataset.firstItem;
    stage.dataset.item = item;
    card.style.setProperty('--zoom', scale);
    stage.dataset.phase = phase;
    if (phase === 'normal' || phase === 'armed' || phase === 'stuck' || (phase === 'open' && !second && angle)) {
      dome.style.setProperty('--turn', angle + 'deg');
    }
    if (innerTurn !== undefined) base.style.setProperty('--inner-turn', innerTurn + 'deg');
    card.classList.toggle('dragging', phase === 'open' && Boolean(dx || dy));
    card.style.setProperty('--drag-x', (offsetX + dx) + 'px');
    card.style.setProperty('--drag-y', (offsetY + dy) + 'px');
  }
  function hit(x, y) {
    const box = base.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height * .49;
    const radius = box.width * .45;
    const distance = Math.hypot(x - cx, y - cy);
    const bounds = card.getBoundingClientRect();
    const bottom = innerHeight - (parseFloat(getComputedStyle(stage).getPropertyValue('--safe-bottom')) || 0);
    return {
      cx, cy, radius, width: innerWidth, left: bounds.left,
      dome: Math.hypot((x - cx) / (box.width * .46), (y - cy) / radius) <= 1,
      rim: distance >= radius * .45 && distance <= box.width * .52,
      outerRadius: box.width * .54,
      secret: y > bottom - 152 && y <= innerHeight && x >= 0 && x <= innerWidth,
      card: stage.dataset.item !== 'none' && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
    };
  }
  function afterExit(done) {
    const transition = card.getAnimations().find(animation =>
      animation.transitionProperty === 'transform' && animation.playState !== 'idle' && animation.playState !== 'finished');
    // Releasing a diagonal swipe can retarget the transform. Follow the new
    // transition so the second reveal is neither lost nor started too early.
    if (transition) transition.finished.then(done, () => afterExit(done));
    else done();
  }
  return { hit, draw, zoomCard, afterExit };
}
