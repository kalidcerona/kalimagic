const prefs = (() => {
  const read = () => { try { return JSON.parse(localStorage.getItem('kc.prefs')) || {}; } catch { return {}; } };
  const value = { fadeCurve: 'linear', goTrigger: 'release', ...read() };
  return { get: key => value[key], set(key, v) { value[key] = v; try { localStorage.setItem('kc.prefs', JSON.stringify(value)); } catch {} } };
})();

export { prefs };
