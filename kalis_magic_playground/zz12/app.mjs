import { freshState } from './core.mjs';
import { installLocalPreview } from './local-preview.mjs'; // local-preview-hook
import { createStorage } from './storage.mjs';
import { createScreenShared } from './screen-shared.mjs';
import { createStudy } from './study.mjs';
import { createQuiz } from './quiz.mjs';
import { createTable } from './table.mjs';
import { createRecords } from './records.mjs';
import { createSettings } from './settings.mjs';
import { createRank } from './rank.mjs';
import { createMemoryModel } from './memory-model.mjs';
import { createMemoryTraining } from './memory-training.mjs';
import { createMemory } from './memory.mjs';

// One live context per boot. Factories attach feature actions before the first render.
const ctx = {};
ctx.KEY = 'magic-memdeck-v1';
ctx.PRESERVED_KEY = ctx.KEY + '-preserved-raw';
ctx.state = freshState();
ctx.storageWarning = '';
ctx.persistenceError = false;
ctx.writeBlocked = false;
ctx.originalRaw = null;
ctx.recoveryReady = false;
ctx.notice = document.querySelector('#notice');
Object.assign(ctx, createStorage(ctx));
ctx.tab = ctx.state.session ? ctx.state.session.mode === 'rank' ? 'rank' : 'quiz' : 'study';
ctx.start = 1;
ctx.end = 52;
ctx.studyIndex = 0;
ctx.flipped = false;
ctx.mode = 'mixed';
ctx.weakOnly = false;
ctx.questionStart = performance.now();
ctx.submitting = false;
ctx.studyMode = 'pair';
ctx.trainMode = 'pair';
ctx.train = null;
ctx.memoryStart = 1;
ctx.memoryEnd = 5;
ctx.imagePos = 1;
ctx.palaceDraft = null;
ctx.storyDraft = null;
ctx.imageDrafts = new Map();
ctx.main = document.querySelector('#main');
ctx.notice = document.querySelector('#notice');
ctx.stackSelect = document.querySelector('#stack');
ctx.cards = () => ctx.state.stacks[ctx.state.selected];
ctx.progress = () => ctx.state.progress[ctx.state.selected];
Object.assign(ctx, createScreenShared(ctx));
Object.assign(ctx, createStudy(ctx));
Object.assign(ctx, createQuiz(ctx));
Object.assign(ctx, createTable(ctx));
Object.assign(ctx, createRecords(ctx));
Object.assign(ctx, createSettings(ctx));
Object.assign(ctx, createRank(ctx));
Object.assign(ctx, createMemoryModel(ctx));
Object.assign(ctx, createMemoryTraining(ctx));
Object.assign(ctx, createMemory(ctx));
ctx.render = render;
function render() {
  ctx.stackSelect.value = ctx.state.selected;
  const art = document.querySelector('.art-card');
  if (art) {
    art.innerHTML = '♣<em>♠</em><small>MEM</small>';
    art.style.color = 'var(--ink)';
  }
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === ctx.tab);
    b.setAttribute('aria-current', b.dataset.tab === ctx.tab ? 'page' : 'false');
  });
  ctx.message(ctx.writeBlocked ? '' : ctx.storageWarning);
  if (!ctx.writeBlocked)
    ctx.storageWarning = '';
  ctx.main.removeAttribute('data-product-settings');
  ctx.main.removeAttribute('data-settings-root');
  if (ctx.tab === 'rank')
    ctx.renderRank();
  if (ctx.tab === 'memory')
    ctx.renderMemory();
  if (ctx.tab === 'study')
    ctx.renderStudy();
  if (ctx.tab === 'quiz')
    ctx.renderQuiz();
  if (ctx.tab === 'table')
    ctx.renderTable();
  if (ctx.tab === 'records')
    ctx.renderRecords();
  if (ctx.tab === 'settings')
    ctx.renderSettings();
  if (ctx.tab === 'settings')
    globalThis.MagicUpdate?.offer();
  else
    globalThis.MagicUpdate?.hide();
}

ctx.stackSelect.onchange = e => {
  ctx.archiveActiveSession();
  ctx.state.selected = e.target.value;
  ctx.state.session = null;
  ctx.studyIndex = 0;
  ctx.flipped = false;
  ctx.train = null;
  ctx.imageDrafts.clear();
  ctx.palaceDraft = null;
  ctx.storyDraft = null;
  ctx.save();
  render();
};

document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  ctx.tab = b.dataset.tab;
  if ([
      'quiz',
      'rank'
    ].includes(ctx.tab) && ctx.state.session && !ctx.state.session.answered)
    ctx.questionStart = performance.now();
  if (ctx.tab === 'memory' && ctx.train?.phase === 'quiz' && !ctx.train.answered)
    ctx.questionStart = performance.now();
  render();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden)
    ctx.questionStart = performance.now();
});

// Keep the screen awake on every visible screen, including settings.
function keepVisibleScreenAwake() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined' || !navigator.wakeLock)
    return;
  let lock = null, pending = false, shortLived = 0;
  const visible = () => document.visibilityState === 'visible';
  const release = () => {
    const current = lock;
    lock = null;
    if (current) {
      try {
        Promise.resolve(current.release()).catch(() => {
        });
      } catch {
      }
    }
  };
  async function request() {
    if (!visible() || lock || pending)
      return;
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!visible()) {
        await acquired.release();
        return;
      }
      lock = acquired;
      const acquiredAt = Date.now();
      acquired.addEventListener('release', () => {
        if (lock === acquired)
          lock = null;
        if (!visible())
          return;
        if (Date.now() - acquiredAt >= 10000)
          shortLived = 0;
        else if (++shortLived >= 3)
          return;
        setTimeout(request, 1000);
      });
    } catch {
    } finally {
      pending = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (visible()) {
      shortLived = 0;
      request();
    } else
      release();
  });
  request();
}

keepVisibleScreenAwake();

function askToKeepStoredData() {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.persist !== 'function')
      return;
    Promise.resolve(navigator.storage.persist()).catch(() => {
    });
  } catch {
  }
}

askToKeepStoredData();

if ('serviceWorker' in navigator) {
  const registration = navigator.serviceWorker.register('./sw.js');
  registration.catch(() => {
  });
  globalThis.MagicUpdate?.init({
    registrationPromise: registration,
    safe: () => ctx.tab === 'settings'
  });
}

render();

installLocalPreview(() => { document.querySelector(".first-run-guide button")?.click(); document.querySelector('[data-tab="settings"]')?.click(); }); // local-preview-hook
