const assert = require('node:assert/strict');
const {origin,offer,launch,fill} = require('./form-fixture.cjs');

(async () => {
  const {page,browser} = await launch();
  let active, next, posts, priceChange;
  await page.route('**/api/seminars/offer?*',route => route.fulfill({json:active}));
  await page.route('**/api/seminars/signup',route => {
    posts.push(route.request().postDataJSON());
    if (priceChange) {
      priceChange = false;
      active = next;
      return route.fulfill({status:409,json:{error:'price_changed',offer:active}});
    }
    return route.fulfill({status:429,json:{error:'rate_limited',retryAfter:12}});
  });
  try {
    for (const path of ['manual','price_changed']) {
      for (const changed of ['neither','photo','privacy','both','photo-text','privacy-version']) {
        active = {...offer,photoNotice:'기존 촬영 안내',privacyNotice:'기존 개인정보 안내'};
        next = {...active,version:'new-price',prices:{...active.prices,bundle:85000}};
        const photo = ['photo','both','photo-text'].includes(changed);
        const privacy = ['privacy','both','privacy-version'].includes(changed);
        if (photo) Object.assign(next,{photoConsentVersion:'photo-v2',photoNotice:'새 촬영 안내'});
        if (privacy) Object.assign(next,{consentVersion:'privacy-v2',privacyNotice:'새 개인정보 안내'});
        if (changed === 'photo-text') next.photoConsentVersion = active.photoConsentVersion;
        if (changed === 'privacy-version') next.privacyNotice = active.privacyNotice;
        posts=[];
        priceChange = path === 'price_changed';
        await page.goto(origin+'/seminar-signup/');
        await fill(page);
        if (priceChange) {
          await page.click('#submit');
          await page.click('#accept-price');
        } else {
          active = next;
          await page.click('#retry');
        }
        await page.waitForFunction(() => document.querySelector('#total').textContent === '85,000원');
        assert.equal(await page.textContent('#photo-notice'),next.photoNotice);
        assert.equal(await page.textContent('#privacy'),next.privacyNotice);
        assert.equal(await page.isChecked('#photo-consent'),!photo);
        assert.equal(await page.isChecked('#consent'),!privacy);
        const before = posts.length;
        if (photo || privacy) {
          await page.click('#submit');
          await page.waitForSelector('#errors:visible');
          assert.equal(posts.length,before,'unchecked notice must block submission');
          if (photo) await page.check('#photo-consent');
          if (privacy) await page.check('#consent');
        }
        await Promise.all([page.waitForResponse(r=>r.status()===429),page.click('#submit')]);
        assert.equal(posts.length,before+1);
        assert.equal(posts.at(-1).photoConsentVersion,next.photoConsentVersion);
        assert.equal(posts.at(-1).consentVersion,next.consentVersion);
      }
    }
    console.log('PASS manual and price_changed refresh x unchanged/photo/privacy/both notices, blocked stale consent and current versions after recheck');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
