const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = require('./output-dir.cjs');
const {origin,offer,widths,launch,fill,measure} = require('./form-fixture.cjs');

(async () => {
  const {page,browser} = await launch();
  try {
    const keys=[];
    const replies = [
      null,
      [409,{error:'price_changed',offer:{...offer,version:'v2',tier:'early',prices:{...offer.prices,bundle:85000}}}],
      [429,{error:'rate_limited',retryAfter:42}],
      [503,{error:'storage_unavailable'}],
      [409,{error:'sold_out'}]
    ];
    await page.route('**/api/seminars/signup',route => {
      const reply=replies[keys.length];
      keys.push(route.request().postDataJSON().idempotencyKey);
      return reply ? route.fulfill({status:reply[0],json:reply[1]}) : route.abort();
    });
    await page.goto(origin+'/seminar-signup/');
    await fill(page);
    await page.click('#submit');
    await page.waitForSelector('#errors:visible');
    await measure(page,'응답 유실',320,'retry');
    await page.click('#submit');
    await page.waitForSelector('#price-change:visible');
    assert.equal(keys[0],keys[1]);
    assert.equal(await page.isDisabled('#submit'),true);
    assert.equal(await page.inputValue('#name'),'테스트 참가자');
    await page.click('#accept-price');
    await page.click('#submit');
    await page.waitForFunction(() => document.querySelector('#errors').textContent.includes('42초'));
    assert.notEqual(keys[1],keys[2]);
    await Promise.all([page.waitForResponse(r=>r.status()===503),page.click('#submit')]);
    assert.equal(keys[3],keys[2]);
    await measure(page,'503',320,'retry503');
    await page.click('#submit');
    await page.waitForSelector('#sold-out:visible');
    assert.equal(await page.evaluate(() => document.activeElement.id),'sold-out-title');
    const reports=[];
    for (const width of widths) reports.push(await measure(page,'매진',width,'sold-out'));
    fs.writeFileSync(output+'/sold-out.json',JSON.stringify(reports,null,2));
    console.log('PASS lost response, 409 reconfirmation, 429 timeout text, 503 same key, sold-out focus and 8 widths');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
