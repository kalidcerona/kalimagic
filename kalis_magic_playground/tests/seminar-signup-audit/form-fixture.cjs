const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core');
const origin = process.env.SEMINAR_AUDIT_ORIGIN || 'http://127.0.0.1:8927';
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Loopback server required');
const widths = [320, 375, 390, 414, 768, 1024, 1280, 1440];
const offer = {
  eventId:'daebeongae', open:true, test:true, version:'test', tier:'super',
  prices:{bundle:80000,special:30000,lecture:20000,show:40000,meeting:30000,open:7000},
  available:['bundle','special','lecture','show','meeting','open'],
  consentVersion:'2026-11-30-v2', photoConsentVersion:'2026-11-30-v2',
  bundleLabel:'슈퍼 얼리버드 통합권', contact:'테스트 문의처'
};
async function launch() {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH, headless:true});
  const page = await browser.newPage();
  page.setDefaultTimeout(5500);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('**/api/seminars/offer?*', route => route.fulfill({json:{offer}}));
  return {browser,page};
}
async function fill(page) {
  await page.check('#age-confirmed');
  await page.fill('#name','테스트 참가자');
  await page.fill('#birth-date','2000-02-29');
  await page.check('#gender-female');
  await page.fill('#contact','010-1234-5678');
  await page.check('#discovery-instagram');
  await page.check('#reason-reviews');
  await page.check('#open-no');
  await page.check('#photo-consent');
  await page.check('#consent');
}
async function measure(page, state, width, prefix) {
  const output = require('./output-dir.cjs');
  await page.setViewportSize({width,height:900});
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const blocks = [];
    for (const element of document.querySelectorAll('h1,h2,h3,legend,p,label,li,button,.total,dt,dd,#errors a')) {
      if (!element.getClientRects().length || element.closest('.sr-only,.trap')) continue;
      const walker = document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
      const rects = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...Array.from(range.getClientRects()).filter(r => r.width && r.height));
      }
      if (!rects.length) continue;
      const rows = [];
      for (const rect of rects.sort((a,b) => a.top-b.top)) {
        const row = rows.find(r => rect.top < r.bottom && rect.bottom > r.top);
        if (row) { row.top = Math.max(row.top,rect.top); row.bottom = Math.min(row.bottom,rect.bottom); }
        else rows.push({top:rect.top,bottom:rect.bottom});
      }
      blocks.push({key:element.id || element.tagName,text:element.textContent.trim().replace(/\s+/g,' '),lines:rows.length});
    }
    const samples = [];
    const selectors = [
      ['h1','#f6f8ff','#213c91',3],
      ['#q5 .phrase','#132650','#f6f8ff',4.5],
      ['#contact-hint','#405477','#f6f8ff',4.5],
      ['#contact','#405477','#ffffff',3],
      ['label[for=bundle]','#132650',null,4.5],
      ['#errors a','#9b2020','#f6f8ff',4.5],
      ['#success-title','#132650','#f6f8ff',4.5],
      ['#sold-out-title','#132650','#f6f8ff',4.5],
      ['#test-warning','#9b2020','#f6f8ff',4.5]
    ];
    for (const [selector,fg,bg,minimum] of selectors) {
      const el = document.querySelector(selector);
      if (!el || !el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      const background = bg || (document.querySelector('#bundle').checked ? '#e8f274' : '#f6f8ff');
      const foreground = selector === '#contact' && el.getAttribute('aria-invalid') === 'true' ? '#9b2020' : fg;
      samples.push({selector,fg:foreground,bg:background,minimum,box:[r.left+scrollX,r.top+scrollY,r.right+scrollX,r.bottom+scrollY]});
    }
    const focused = document.querySelector('input:focus-visible');
    if (focused) {
      const r = focused.getBoundingClientRect();
      samples.push({selector:'focus ring',fg:'#132650',bg:'#f6f8ff',minimum:3,
        box:[r.left+scrollX-7,r.top+scrollY-7,r.right+scrollX+7,r.top+scrollY]});
    }
    return {overflow:document.documentElement.scrollWidth > innerWidth,blocks,samples};
  });
  assert.equal(metrics.overflow,false,state+' '+width);
  const fs = require('node:fs');
  const {spawnSync} = require('node:child_process');
  const path = require('node:path');
  const tiles = fs.mkdtempSync(path.join(output,'tiles-'));
  const geometry = await page.evaluate(() => ({height:document.documentElement.scrollHeight,y:scrollY}));
  const frames = [];
  try {
    for (let top=0; top<geometry.height; top+=900) {
      const y = await page.evaluate(async value => {
        const target = Math.min(value,document.documentElement.scrollHeight - innerHeight);
        for (let attempt=0;attempt<12;attempt++) {
          window.scrollTo({top:Math.max(0,target),behavior:'instant'});
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          if (scrollY === Math.max(0,target)) return scrollY;
        }
        throw Error('Viewport did not settle at '+target+' (actual '+scrollY+')');
      },top);
      const file = path.join(tiles,frames.length+'.png');
      await page.screenshot({path:file});
      frames.push({y,file});
    }
    const stitch = spawnSync('python3',[path.join(__dirname,'stitch.py')],{
      input:JSON.stringify({width,height:geometry.height,frames,file:path.join(output,prefix+'-'+width+'.png')}),
      encoding:'utf8'
    });
    if (stitch.status !== 0) throw Error(stitch.stderr || String(stitch.error));
  } finally {
    await page.evaluate(y => window.scrollTo(0,y),geometry.y);
    fs.rmSync(tiles,{recursive:true,force:true});
  }
  return {state,width,...metrics};
}
module.exports = {origin,offer,widths,launch,fill,measure};
