export function installTheme({ stage, arrow, spinStatus }) {
  // Table appearance has its own storage and never changes the performance state.
  const tableThemeKey = 'zz11-table-theme-v1';
  const tableThemeSelect = document.getElementById('table-theme');
  function normalizeTableTheme(value) { return value === 'burgundy' ? 'burgundy' : 'emerald'; }
  function applyTableTheme(value) {
    const theme = normalizeTableTheme(value);
    stage.dataset.tableTheme = theme;
    tableThemeSelect.value = theme;
    return theme;
  }
  let savedTableTheme = null;
  try { savedTableTheme = localStorage.getItem(tableThemeKey); } catch { /* Use the default table without storage. */ }
  applyTableTheme(savedTableTheme);
  tableThemeSelect.addEventListener('change', event => {
    const theme = applyTableTheme(event.target.value);
    try { localStorage.setItem(tableThemeKey, theme); } catch { /* Keep the selected table for this session. */ }
  });

  // Screen design is separate from table color and never changes the performance state.
  const screenDesignKey = 'zz11-screen-design-v1';
  const screenDesignSelect = document.getElementById('screen-design');
  const instrumentHeader = document.querySelector('.instrument-header');
  const stageBottom = document.querySelector('.stage-bottom');
  const casinoArrow = './casino-assets/arrow.svg';
  const hybridArrow = './hybrid-assets/arrow.svg';
  function normalizeScreenDesign(value) { return value === 'hybrid' ? 'hybrid' : 'casino'; }
  function applyScreenDesign(value) {
    const design = normalizeScreenDesign(value);
    if (design === 'hybrid') instrumentHeader.appendChild(spinStatus);
    else stageBottom.appendChild(spinStatus);
    stage.dataset.screenDesign = design;
    screenDesignSelect.value = design;
    const nextArrow = design === 'hybrid' ? hybridArrow : casinoArrow;
    if (arrow.getAttribute('src') !== nextArrow) arrow.src = nextArrow;
    return design;
  }
  let savedScreenDesign = null;
  try { savedScreenDesign = localStorage.getItem(screenDesignKey); } catch { /* Use the casino screen without storage. */ }
  applyScreenDesign(savedScreenDesign);
  screenDesignSelect.addEventListener('change', event => {
    const design = applyScreenDesign(event.target.value);
    try { localStorage.setItem(screenDesignKey, design); } catch { /* Keep the selected screen for this session. */ }
  });

}
