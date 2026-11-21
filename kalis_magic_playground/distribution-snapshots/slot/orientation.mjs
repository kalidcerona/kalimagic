export function portraitGuard(onChange) {
  const media = matchMedia('(orientation: landscape)');
  media.addEventListener('change', onChange);
  try { screen.orientation?.lock?.('portrait')?.catch(() => {}); } catch {}
  return () => media.matches;
}
