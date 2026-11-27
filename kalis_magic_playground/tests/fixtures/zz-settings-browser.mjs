import assert from 'node:assert/strict';

export async function checkSettings(page, target) {
  await page.waitForFunction(() => document.querySelector('[data-zz-ready="true"]'));
  const handlers = {
    kairos: ['app.js', 'openSettings'],
    'kairos-classic': ['app.js', 'openSettings'],
    aletheia: ['pointer.js', 'openSettings'],
    tobira: ['mode-switch.js', 'showSettings'],
    asrai: ['contacts-gestures.js', 'openSettings'],
    usotsuki: ['controller-screens.js', 'openSettings'],
    uramichi: ['presets.mjs', 'openSettings'],
  };
  if (target === 'release') {
    await page.evaluate(async () => (await import('./session.js')).session.showScreen('settings'));
  } else if (handlers[target]) {
    await page.evaluate(
      async ([file, method, ...args]) => (await import('./' + file))[method](...args),
      handlers[target],
    );
  } else if (['pimax', 'memdeck', 'alter'].includes(target)) {
    const selector = {
      pimax: '[data-tab=settings]',
      memdeck: '[data-tab=settings]',
      alter: '#setup-settings',
    }[target];
    await page.locator(selector).first().evaluate((button) => button.click());
  } else {
    if (target === 'arosaegida' && await page.getByRole('button', { name: '알겠어요' }).isVisible()) {
      await page.getByRole('button', { name: '알겠어요' }).click();
    }
    if (target === 'tyche' && await page.locator('#guide-close').isVisible()) {
      await page.locator('#guide-close').click();
    }
    const cdp = await page.context().newCDPSession(page);
    for (const [type, y] of [['touchStart', 120], ['touchMove', 170], ['touchMove', 280], ['touchEnd', 0]]) {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: y ? [{ x: 110, y, id: 1 }, { x: 180, y, id: 2 }] : [],
      });
    }
    await cdp.detach();
  }

  const container = {
    kairos: '#settings-card',
    'kairos-classic': '#settings-card',
    release: '#settings-screen',
    hitsuzen: '#date-settings',
    usotsuki: '#settings-screen',
    asrai: '#settings-screen',
    memdeck: '[data-product-settings]',
    pimax: '[data-product-settings]',
  }[target] || '#settings';
  const settings = page.locator(container).first();
  await settings.waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-zz-import]').count(), 0, target);
  assert.doesNotMatch(await settings.innerText(), /이전 ZZ|ZZ 데이터|백업 파일 가져오기|가져온 데이터 상세/);
  return settings;
}

// Use the former button's write path, including native validators loaded by the app.
export async function seedCompletedImport(page, target, source = 'raw') {
  await page.evaluate(async ({ target, source }) => {
    const base = '/tools/' + target + '/zz-import/';
    const { exclusiveWrite } = await import(base + 'ui-bootstrap.mjs');
    const { discoverSources } = await import(base + 'data.mjs');
    const { applyImport, previewImport } = await import(base + 'apply.mjs');
    const candidate = (await discoverSources(target)).candidates.find((entry) => entry.source === source);
    if (!candidate) throw new Error('Missing ' + source + ' fixture for ' + target);
    const preview = await previewImport(target, candidate);
    const receipt = await exclusiveWrite(() =>
      applyImport(target, candidate, { activate: 'zz', expectedRevision: preview.revision })
    );
    if (!receipt.verified) throw new Error('Import fixture failed verification');
  }, { target, source });
}
