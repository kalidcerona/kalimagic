const assert = require('node:assert/strict');
const fs = require('node:fs');
const output = require('./output-dir.cjs');
const {origin,widths,launch,measure} = require('./form-fixture.cjs');

(async () => {
  const {page,browser} = await launch();
  const reports = [];
  const requests = [];
  async function capture(state,prefix) {
    for (const width of widths) reports.push(await measure(page,state,width,prefix));
  }
  async function tabTo(id) {
    for (let i=0; i<45; i++) {
      if (await page.evaluate(() => document.activeElement.id) === id) return;
      await page.keyboard.press('Tab');
    }
    throw Error('Keyboard focus did not reach '+id);
  }
  async function choose(id) {
    await tabTo(id);
    await page.keyboard.press('Space');
    assert.equal(await page.isChecked('#'+id),true);
  }
  try {
    await page.route('**/api/seminars/signup',route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({json:{receipt:{
        id:'TEST-ONLY',items:[{label:'통합권',price:80000}],total:80000,
        payerName:'테스트 참가자',paymentDueAt:'2026-12-16T01:05:00.000Z', test:true,
        payment:{bank:'테스트 은행',account:'[테스트 계좌]',holder:'테스트 운영자',contact:'테스트 문의처',test:true}
      }}});
    });
    await page.goto(origin+'/seminar-signup/');
    await page.waitForFunction(() => document.querySelector('#total').textContent === '80,000원');
    assert.match(await page.textContent('#availability'),/송금하지 마/);
    await capture('초기','initial');
    await page.check('#open');
    assert.equal(await page.textContent('#total'),'87,000원');
    await page.check('#single');
    await page.check('#ticket-lecture');
    await page.check('#ticket-show');
    assert.equal(await page.textContent('#total'),'67,000원');
    await page.check('#discovery-other');
    await page.check('#reason-other');
    await capture('선택','selected');
    await page.check('#bundle');
    assert.equal(await page.locator('#singles input:checked').count(),0);
    await page.focus('#submit');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id),'name');
    await capture('오류','error');
    await page.reload();
    await tabTo('name');
    await page.keyboard.insertText('테스트 참가자');
    await tabTo('birth-date');
    // The Korean document uses year, month, day in Chromium's date control.
    await page.keyboard.type('2000');
    await page.keyboard.press('Tab');
    await page.keyboard.type('0229');
    assert.equal(await page.inputValue('#birth-date'),'2000-02-29');
    await choose('gender-male');
    await tabTo('contact');
    await page.keyboard.type('01012345678');
    for (const [group,first] of [['discovery','instagram'],['reason','content']]) {
      await tabTo(group+'-'+first);
      await page.keyboard.press('End');
      if (!await page.isChecked('#'+group+'-other')) {
        for (let i=0;i<3;i++) await page.keyboard.press('ArrowDown');
      }
      await tabTo(group+'-other-text');
      await page.keyboard.insertText('테스트 기타');
    }
    await tabTo('bundle');
    await page.keyboard.press('ArrowDown');
    await choose('ticket-special');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.isChecked('#bundle'),true);
    await tabTo('open');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.isChecked('#open-no'),true);
    await page.check('#age-confirmed');
    await choose('photo-consent');
    await choose('consent');
    await tabTo('submit');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#success:visible');
    assert.equal(await page.evaluate(() => document.activeElement.id),'success-title');
    assert.match(await page.textContent('#receipt'),/2026년 12월 16일 10:05:00 \(KST\)/);
    assert.match(await page.textContent('#test-warning'),/송금/);
    await page.context().grantPermissions(['clipboard-read','clipboard-write']);
    await page.click('#copy');
    assert.doesNotMatch(await page.evaluate(() => navigator.clipboard.readText()),/01012345678/);
    await capture('완료','success');
    await page.reload();
    assert.equal(requests.length,1);
    await page.evaluate(() => document.body.style.zoom='2');
    reports.push(await measure(page,'200% 확대',320,'zoom'));
    fs.writeFileSync(output+'/form-audit.json',JSON.stringify(reports,null,2));
    console.log('PASS 4 states x 8 widths, block lines, keyboard submission with both other answers, receipt, copy, reload, 320px zoom');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
