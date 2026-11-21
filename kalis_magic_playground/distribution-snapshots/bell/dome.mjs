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
  function draw(phase, { angle = 0, dx = 0, dy = 0 } = {}) {
    stage.dataset.phase = phase;
    if (phase !== 'open' && phase !== 'empty' || angle) dome.style.setProperty('--turn', angle + 'deg');
    card.classList.toggle('dragging', phase === 'open' && Boolean(dx || dy));
    card.style.setProperty('--drag-x', dx + 'px');
    card.style.setProperty('--drag-y', dy + 'px');
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
      dome: distance <= radius, rim: distance >= radius * .45 && distance <= radius,
      secret: y >= bottom - 44 && y <= bottom && x >= innerWidth * .15 && x <= innerWidth * .85,
      card: x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
    };
  }
  return { hit, draw };
}
