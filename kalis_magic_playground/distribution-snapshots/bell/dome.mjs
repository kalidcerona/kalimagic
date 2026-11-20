let release;
export function press(dome) {
  clearTimeout(release);
  dome.classList.add('pressed');
  release = setTimeout(() => dome.classList.remove('pressed'), 90);
}
