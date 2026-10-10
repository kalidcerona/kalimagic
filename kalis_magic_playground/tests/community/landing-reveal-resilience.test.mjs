import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const navSource = read('nav.js');
const revealSource = read('reveal.js');
const htmlSource = read('index.html');
const cssSource = read('style.css');

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
    values
  };
}

function node(classes = []) {
  return {
    classList: classList(classes),
    children: [],
    dataset: {},
    style: { setProperty() {} },
    querySelectorAll() { return []; }
  };
}

function page({ observer = 'normal', reveal = true } = {}) {
  const desktop = node(['kx-fade']);
  const mobile = node();
  const simpleFade = node(['fade-in']);
  const documentElement = { classList: classList() };
  const observers = [];
  const document = {
    readyState: 'complete',
    documentElement,
    addEventListener() {},
    querySelectorAll(selector) {
      if (selector === '.kx-desktop .kx-fade') return [desktop];
      if (selector === '.kx-mobile .kx-shell > div') return [mobile];
      if (selector === '.kx-desktop .kx-fade, .kx-mobile .kx-shell > div') return [desktop, mobile];
      if (selector === '.fade-in') return [desktop, mobile, simpleFade];
      return [];
    }
  };
  const window = {};
  if (observer === 'missing') {
    // IntersectionObserver intentionally absent.
  } else if (observer === 'constructor-throws') {
    window.IntersectionObserver = function () { throw new Error('observer unavailable'); };
  } else {
    window.IntersectionObserver = function (callback) {
      if (observer === 'normal') {
        this.callback = callback;
        this.observed = [];
        this.observe = (target) => this.observed.push(target);
        this.unobserve = () => {};
        observers.push(this);
      } else {
        this.observe = () => { throw new Error('observe failed'); };
        this.unobserve = () => {};
      }
    };
  }
  const context = { document, window, IntersectionObserver: window.IntersectionObserver };
  vm.runInNewContext(navSource, context, { filename: 'nav.js' });
  if (reveal) vm.runInNewContext(revealSource, context, { filename: 'reveal.js' });
  return { document, window, desktop, mobile, simpleFade, observers };
}

test('nav.js keeps reveals visible when reveal.js never loads', () => {
  const state = page({ reveal: false });
  assert.equal(state.document.documentElement.classList.contains('js-anim'), false);
  assert.match(cssSource, /\.js-anim \.kx-mobile \.kx-shell > div\{ opacity:0/);
  assert.equal(state.window.__pgRevealDone, undefined);
});

test('missing IntersectionObserver reveals all content immediately', () => {
  const state = page({ observer: 'missing' });
  assert.equal(state.document.documentElement.classList.contains('js-anim'), true);
  for (const el of [state.desktop, state.mobile, state.simpleFade]) {
    assert.equal(el.classList.contains(el.classList.contains('fade-in') ? 'visible' : 'kx-in'), true);
  }
});

test('throwing observer construction leaves content visible and does not enable hiding', () => {
  const state = page({ observer: 'constructor-throws' });
  assert.equal(state.document.documentElement.classList.contains('js-anim'), false);
  assert.equal(state.desktop.classList.contains('kx-in'), true);
  assert.equal(state.mobile.classList.contains('kx-in'), true);
  assert.equal(state.simpleFade.classList.contains('visible'), true);
  assert.equal(state.window.__pgRevealDone, true);
});

test('throwing observe leaves content visible even after partial setup', () => {
  const state = page({ observer: 'observe-throws' });
  assert.equal(state.document.documentElement.classList.contains('js-anim'), false);
  assert.equal(state.desktop.classList.contains('kx-in'), true);
  assert.equal(state.mobile.classList.contains('kx-in'), true);
  assert.equal(state.simpleFade.classList.contains('visible'), true);
});

test('normal observer setup enables animation only after observing, then reveals intersecting nodes', () => {
  const state = page();
  assert.equal(state.observers.length, 1);
  assert.equal(state.observers[0].observed.length, 3);
  assert.equal(state.document.documentElement.classList.contains('js-anim'), true);
  assert.equal(state.desktop.classList.contains('kx-in'), false);
  state.observers[0].callback([{ target: state.desktop, isIntersecting: true }]);
  assert.equal(state.desktop.classList.contains('kx-in'), true);
  assert.equal(state.mobile.classList.contains('kx-in'), false);
});

test('hero preloads match the visible responsive image and elevate the mobile hero', () => {
  const preloadTags = [...htmlSource.matchAll(/<link rel="preload" as="image"[^>]*>/g)].map(([tag]) => tag);
  const desktop = preloadTags.find((tag) => tag.includes('bar-reaction-1080w.webp'));
  const mobile = preloadTags.find((tag) => tag.includes('magic-reaction-800w.webp'));
  assert.ok(desktop);
  assert.match(desktop, /media="\(min-width: 1025px\)"/);
  assert.match(desktop, /imagesizes="\(min-width:1025px\) 540px, 100vw"/);
  assert.ok(mobile);
  assert.match(mobile, /type="image\/webp"/);
  assert.match(mobile, /media="\(max-width: 1024px\)"/);
  assert.match(mobile, /imagesizes="430px"/);
  const hero = htmlSource.match(/<img src="assets\/profile\/magic-reaction\.jpg"[^>]*>/)?.[0];
  assert.ok(hero);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchpriority="high"/);
  assert.match(cssSource, /@media \(max-width: 1024px\) \{\s*\.kx-desktop \{ display: none !important; \}\s*\.kx-mobile  \{ display: block !important; \}/);
});
