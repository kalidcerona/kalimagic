import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const settingsSource = fs.readFileSync(new URL('../../zz4/settings-ui.js', import.meta.url), 'utf8');

function element(tag) {
  const listeners = {};
  const attributes = [];
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    value: '',
    min: '0',
    max: '100',
    step: '1',
    type: '',
    hidden: false,
    disabled: false,
    inert: false,
    src: '',
    alt: '',
    href: '',
    rel: '',
    dataset: {},
    children: [],
    parentElement: null,
    parentNode: null,
    clientWidth: 180,
    clientHeight: 390,
    clientLeft: 0,
    clientTop: 0,
    style: {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
      getPropertyValue(name) { return this[name] || ''; },
    },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) {
      if (!child) return child;
      child.parentElement = el;
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    append(...kids) { kids.forEach((kid) => el.appendChild(kid)); },
    replaceChildren(...kids) {
      el.replaces += 1;
      el.children = [];
      kids.forEach((kid) => el.appendChild(kid));
    },
    replaces: 0,
    remove() {
      const parent = el.parentElement;
      if (!parent) return;
      parent.children = parent.children.filter((child) => child !== el);
      el.parentElement = null;
      el.parentNode = null;
    },
    setAttribute(name, value) {
      const found = attributes.find((attr) => attr.name === name);
      if (found) found.value = String(value);
      else attributes.push({ name, value: String(value) });
    },
    getAttribute(name) { return attributes.find((attr) => attr.name === name)?.value ?? null; },
    removeAttribute(name) {
      const index = attributes.findIndex((attr) => attr.name === name);
      if (index >= 0) attributes.splice(index, 1);
    },
    get attributes() { return attributes; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatchEvent(event) { (listeners[event.type] || []).forEach((fn) => fn(event)); return true; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByTagName() { return { length: 0 }; },
    closest() { return null; },
    focus() {},
    cloneNode(deep) {
      if (deep) el.ownerCounts.deep += 1;
      const copy = element(tag);
      copy.className = el.className;
      copy.textContent = el.textContent;
      return copy;
    },
    attachShadow() {
      el.ownerCounts.shadows += 1;
      const shadow = {
        appendChild(child) { return el.appendChild(child); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      el.shadowRoot = shadow;
      return shadow;
    },
    getBoundingClientRect() { return { left: 8, top: 8, right: 48, bottom: 48, width: 40, height: 40, x: 8, y: 8 }; },
    ownerCounts: null,
  };
  Object.defineProperty(el, 'childElementCount', { get() { return el.children.length; } });
  return el;
}

function mountSettings({ app, source = true, tobira = false }) {
  const counts = { deep: 0, shadows: 0 };
  const make = (tag) => {
    const node = element(tag);
    node.ownerCounts = counts;
    node.cloneNode = function clone(deep) {
      if (deep) counts.deep += 1;
      const copy = element(tag);
      copy.ownerCounts = counts;
      copy.className = node.className;
      copy.textContent = node.textContent;
      return copy;
    };
    node.attachShadow = function shadow() {
      counts.shadows += 1;
      const root = {
        appendChild(child) { return node.appendChild(child); },
        querySelector() { return null; },
        querySelectorAll() { return []; },
      };
      node.shadowRoot = root;
      return root;
    };
    return node;
  };
  const body = make('body');
  body.dataset.magicApp = app;
  const container = make('section');
  const home = make('section');
  home.id = 'fake-home';
  const coin = { '#coin-size': null, '#start-x': null, '#start-y': null };
  if (tobira) {
    for (const id of Object.keys(coin)) {
      const input = make('input');
      input.id = id.slice(1);
      input.min = '0.05';
      input.max = '0.8';
      input.step = '0.01';
      input.value = '0.3';
      coin[id] = input;
    }
  }
  const frames = [];
  const sandbox = {
    document: {
      readyState: 'complete',
      body,
      documentElement: make('html'),
      styleSheets: [{ cssRules: [{ cssText: 'body{margin:0}' }] }],
      createElement: make,
      querySelector(selector) {
        const text = String(selector);
        if (text.includes('data-settings-root') || text === '#settings .shell' || text === '#settings .sheet') return container;
        if (source && text === '#fake-home') return home;
        if (coin[text]) return coin[text];
        return null;
      },
      querySelectorAll() { return []; },
      addEventListener() {},
      dispatchEvent() { return true; },
    },
    location: { hash: '', search: '', pathname: '/zz4/', origin: 'https://example.test' },
    navigator: { userAgent: 'test', platform: 'Mac', maxTouchPoints: 0 },
    innerWidth: 412,
    innerHeight: 915,
    getComputedStyle() { return { color: '#111', font: '16px sans-serif', transformOrigin: '50% 50%', order: '0' }; },
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class Event { constructor(type) { this.type = type; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener() {},
    setTimeout(fn) { fn(); return 0; },
  };
  if (tobira) {
    let model = { image: 'objects/card.png', widthRatio: 0.3, startX: 0.2, startY: 0.4 };
    sandbox.MagicTobiraAppearance = {
      preview() { return model; },
      read() { return { coinSize: model.widthRatio, startX: model.startX, startY: model.startY }; },
      update(value) { model = { ...model, widthRatio: value.coinSize, startX: value.startX, startY: value.startY, image: model.image }; },
    };
  }
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInContext(settingsSource, vm.createContext(sandbox));
  const flush = () => { const queued = frames.splice(0); queued.forEach((fn) => fn()); };
  flush();
  const open = [...container.children, ...body.children].flatMap((node) => [node, ...(node.children || [])]).find((node) => node && node.textContent === '화면 커스텀');
  assert.ok(open, 'customize button');
  open.dispatchEvent({ type: 'click' });
  flush();
  const phone = body.children.find((node) => node.className === 'magic-customize-page').children.find((node) => node.className === 'magic-customize-preview').children.find((node) => node.className === 'magic-preview-phone');
  return { counts, phone, flush, sandbox, home };
}

function sliderInputs(phone) {
  const page = phone.parentElement.parentElement;
  const inputs = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.tagName === 'INPUT' && node.type === 'range') inputs.push(node);
    (node.children || []).forEach(walk);
  };
  walk(page);
  return inputs;
}

test('shared preview mounts once for slider updates and for tobira', () => {
  const generic = mountSettings({ app: 'choice' });
  const mounted = { ...generic.counts, replaces: generic.phone.replaces };
  assert.equal(mounted.shadows, 1);
  assert.equal(mounted.deep, 1);
  assert.equal(mounted.replaces, 1);
  const ranges = sliderInputs(generic.phone);
  assert.ok(ranges.length >= 3);
  for (let step = 0; step < 8; step += 1) {
    const input = ranges[step % ranges.length];
    input.value = String(Number(input.min) + step + 1);
    input.dispatchEvent({ type: 'input' });
    generic.flush();
  }
  assert.equal(generic.counts.shadows, 1, 'slider input must not attach another shadow root');
  assert.equal(generic.counts.deep, 1, 'slider input must not deep-clone the preview');
  assert.equal(generic.phone.replaces, 1);

  const tobira = mountSettings({ app: 'tobira', source: false, tobira: true });
  assert.equal(tobira.counts.shadows, 0);
  assert.equal(tobira.counts.deep, 0);
  const art = tobira.phone.children[0].children[0].children[0];
  assert.equal(art.tagName, 'IMG');
  assert.equal(art.src, 'objects/card.png');
  const tobiraRanges = sliderInputs(tobira.phone);
  const objectSlider = tobiraRanges.find((input) => input.step === '0.01');
  assert.ok(objectSlider);
  for (let step = 0; step < 8; step += 1) {
    objectSlider.value = String(0.1 + step * 0.01);
    objectSlider.dispatchEvent({ type: 'input' });
    tobira.flush();
  }
  assert.equal(tobira.counts.shadows, 0);
  assert.equal(tobira.counts.deep, 0);
  assert.equal(tobira.phone.replaces, 1);
  assert.equal(tobira.phone.children[0].children[0].children[0], art, 'tobira preview keeps the same image node');
  assert.equal(art.src, 'objects/card.png');
});

test('missing preview source still falls back to the profile name', () => {
  const missing = mountSettings({ app: 'choice', source: false });
  assert.equal(missing.counts.shadows, 0);
  assert.equal(missing.counts.deep, 0);
  assert.equal(missing.phone.children.at(-1).textContent, '너의 선택은?');
});

function domElement(tag = 'div') {
  const listeners = {};
  const node = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    id: '',
    className: '',
    textContent: '',
    value: '',
    checked: false,
    hidden: false,
    disabled: false,
    open: false,
    inert: false,
    type: '',
    title: '',
    tabIndex: 0,
    src: '',
    alt: '',
    min: '',
    max: '',
    step: '',
    dataset: {},
    style: new Proxy({}, {
      get(target, key) {
        if (key === 'setProperty') return (name, value) => { target[name] = value; };
        if (key === 'removeProperty') return (name) => { delete target[name]; };
        return target[key] ?? '';
      },
      set(target, key, value) { target[key] = value; return true; },
    }),
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    children: [],
    attributes: {},
    parentElement: null,
    parentNode: null,
    appendChild(child) {
      if (child && typeof child === 'object') {
        child.parentElement = node;
        child.parentNode = node;
        node.children.push(child);
      }
      return child;
    },
    append(...kids) { kids.forEach((kid) => { if (kid && typeof kid === 'object' && kid.appendChild) node.appendChild(kid); }); },
    replaceChildren(...kids) {
      node.children = [];
      kids.flat().forEach((kid) => node.appendChild(kid));
    },
    remove() {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = null;
      node.parentNode = null;
    },
    setAttribute(name, value) { node.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(node.attributes, name) ? node.attributes[name] : null; },
    removeAttribute(name) { delete node.attributes[name]; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    dispatchEvent(event) { (listeners[event.type] || []).forEach((fn) => fn(event)); return true; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    matches() { return false; },
    contains() { return false; },
    focus() {},
    click() {},
    cloneNode() { return domElement(tag); },
    getBoundingClientRect() { return { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20, x: 0, y: 0 }; },
    scrollIntoView() {},
    showModal() {},
    close() {},
  };
  return node;
}

test('persist writes the store once without parsing it back, and a second performance entry does not parse icons', async () => {
  const store = new Map();
  const icon = JSON.stringify([{ id: 'probe', label: 'Probe', page: 2, row: 0, col: 0, dataUrl: 'data:image/png;base64,aaaa' }]);
  store.set('magic-choice.v1.user-icons', icon);
  const writes = [];
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { writes.push(key); store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
  };
  const grids = [0, 1, 2].map((page) => {
    const grid = domElement('div');
    grid.dataset.homeGrid = String(page);
    return grid;
  });
  const fakeHome = domElement('section');
  fakeHome.id = 'fake-home';
  fakeHome.hidden = true;
  fakeHome.querySelectorAll = (selector) => (selector === '[data-home-grid]' ? grids : []);
  const dock = domElement('div');
  let gridBuilds = 0;
  for (const grid of [...grids, dock]) {
    const replace = grid.replaceChildren.bind(grid);
    grid.replaceChildren = (...args) => { gridBuilds += 1; return replace(...args); };
  }
  const byId = new Map([['fake-home', fakeHome], ['phone-dock', dock]]);
  const document = {
    title: '',
    readyState: 'complete',
    body: Object.assign(domElement('body'), { dataset: { view: 'settings' } }),
    documentElement: domElement('html'),
    getElementById(id) {
      if (!byId.has(id)) byId.set(id, domElement('div'));
      return byId.get(id);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement: domElement,
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    addEventListener() {},
    dispatchEvent() { return true; },
  };
  const realParse = JSON.parse;
  let parses = 0;
  let iconParses = 0;
  JSON.parse = (text, reviver) => {
    parses += 1;
    if (typeof text === 'string' && text.includes('Probe')) iconParses += 1;
    return realParse(text, reviver);
  };
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    location: globalThis.location,
    navigator: globalThis.navigator,
    history: globalThis.history,
    localStorage: globalThis.localStorage,
    HTMLElement: globalThis.HTMLElement,
    Option: globalThis.Option,
    addEventListener: globalThis.addEventListener,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };
  globalThis.document = document;
  globalThis.window = globalThis;
  if (typeof globalThis.addEventListener !== 'function') globalThis.addEventListener = () => {};
  globalThis.location = { protocol: 'file:', href: 'file:///zz4/', pathname: '/zz4/', hash: '', search: '' };
  globalThis.navigator = { userAgent: 'test' };
  globalThis.history = { state: null, pushState() {}, replaceState() {}, back() {} };
  globalThis.localStorage = storage;
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.Option = class Option {
    constructor(text, value) {
      this.tagName = 'OPTION';
      this.textContent = String(text ?? '');
      this.value = String(value ?? '');
      this.children = [];
    }
  };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.setTimeout = () => 0;
  globalThis.clearTimeout = () => {};
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  try {
    await import('../../zz4/app.js');
    assert.equal(iconParses, 1, 'boot parses the icon store once');
    const built = gridBuilds;
    const parsed = parses;
    byId.get('start-notes-show').dispatchEvent({ type: 'click' });
    assert.equal(fakeHome.hidden, false, 'performance opened');
    byId.get('fake-notes-home').dispatchEvent({ type: 'click' });
    byId.get('start-notes-show').dispatchEvent({ type: 'click' });
    assert.equal(fakeHome.hidden, false);
    assert.equal(iconParses, 1, 're-entry does not parse icons');
    assert.equal(parses, parsed, 're-entry does not parse storage');
    assert.equal(gridBuilds, built, 're-entry does not replace home grids');

    writes.length = 0;
    const before = parses;
    const startMode = byId.get('opt-start-mode');
    startMode.value = 'performance';
    startMode.dispatchEvent({ type: 'change' });
    assert.deepEqual(writes.filter((key) => key === 'magic-choice.v1.store'), ['magic-choice.v1.store']);
    assert.equal(parses, before, 'persist does not parse what it just wrote');
    assert.equal(realParse(store.get('magic-choice.v1.store')).options.startMode, 'performance');
  } finally {
    JSON.parse = realParse;
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.location = previous.location;
    globalThis.navigator = previous.navigator;
    globalThis.history = previous.history;
    globalThis.localStorage = previous.localStorage;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.Option = previous.Option;
    globalThis.addEventListener = previous.addEventListener;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    globalThis.cancelAnimationFrame = previous.cancelAnimationFrame;
    globalThis.setTimeout = previous.setTimeout;
    globalThis.clearTimeout = previous.clearTimeout;
    globalThis.setInterval = previous.setInterval;
    globalThis.clearInterval = previous.clearInterval;
  }
});

// Later tests eval a copy of zz4/app.js inside a vm. Timer and animation-frame
// stubs stay on that sandbox, so they cannot leak into the persist test above.
function choiceHarness() {
  const ids = new Map();
  const focus = { node: null };
  const frames = [];
  function classListOf(node) {
    const tokens = () => String(node.className || '').split(/\s+/).filter(Boolean);
    return {
      add(...names) {
        const set = new Set(tokens());
        names.forEach((name) => set.add(name));
        node.className = [...set].join(' ');
      },
      remove(...names) {
        const drop = new Set(names);
        node.className = tokens().filter((name) => !drop.has(name)).join(' ');
      },
      toggle(name, force) {
        const has = tokens().includes(name);
        const next = force === undefined ? !has : Boolean(force);
        if (next) this.add(name); else this.remove(name);
        return next;
      },
      contains(name) { return tokens().includes(name); },
    };
  }
  function stamp(node, shadow) {
    node._shadow = shadow;
    (node.children || []).forEach((child) => stamp(child, shadow));
  }
  function simple(node, sel) {
    if (sel.startsWith('#')) return node.id === sel.slice(1);
    if (sel.startsWith('.')) return String(node.className || '').split(/\s+/).includes(sel.slice(1));
    if (sel === '[id]') return Boolean(node.id);
    if (sel === '[tabindex]') return node.attributes.has('tabindex');
    const data = sel.match(/^\[data-([A-Za-z0-9-]+)(?:="([^"]*)")?\]$/);
    if (data) {
      const key = data[1].replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const value = node.dataset ? node.dataset[key] : undefined;
      if (data[2] === undefined) return value != null && value !== '';
      return String(value ?? '') === data[2];
    }
    if (sel.includes('[') || sel.includes('*') || sel.includes(':')) return false;
    return String(node.tagName || '').toUpperCase() === sel.toUpperCase();
  }
  function matchesChain(node, selector) {
    const parts = selector.split(/\s+/).filter(Boolean);
    if (!parts.length || !simple(node, parts[parts.length - 1])) return false;
    let current = node;
    for (let index = parts.length - 2; index >= 0; index -= 1) {
      let parent = current.parentElement;
      let found = null;
      while (parent) {
        if (simple(parent, parts[index])) { found = parent; break; }
        parent = parent.parentElement;
      }
      if (!found) return false;
      current = found;
    }
    return true;
  }
  function collect(root, selector) {
    const parts = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
    const found = [];
    const visit = (node) => {
      (node.children || []).forEach((child) => {
        if (!child || child.nodeType === 3) return;
        if (parts.some((part) => matchesChain(child, part))) found.push(child);
        visit(child);
      });
    };
    visit(root);
    return found;
  }
  function adopt(parent, child) {
    if (!child || child.nodeType === 3) return child;
    if (child.nodeType === 11) {
      const kids = child.children.splice(0, child.children.length);
      for (let index = 0; index < kids.length; index += 1) {
        kids[index].parentElement = null;
        kids[index].parentNode = null;
        adopt(parent, kids[index]);
      }
      return child;
    }
    if (child.parentElement) child.remove();
    child.parentElement = parent;
    child.parentNode = parent;
    parent.children.push(child);
    if (parent._shadow) stamp(child, parent._shadow);
    return child;
  }
  function make(tag, props = {}, register = true) {
    const node = {
      tagName: String(tag || 'div').toUpperCase(),
      nodeType: 1,
      id: '',
      className: props.className || '',
      textContent: props.textContent || '',
      value: props.value ?? '',
      checked: false,
      hidden: Boolean(props.hidden),
      disabled: false,
      inert: false,
      type: props.type || '',
      title: '',
      tabIndex: 0,
      src: '',
      alt: '',
      min: props.min || '',
      max: props.max || '',
      step: props.step || '',
      dataset: { ...(props.dataset || {}) },
      attributes: new Map(),
      children: [],
      parentElement: null,
      parentNode: null,
      _shadow: null,
      replacements: 0,
      _measures: 0,
      _draws: [],
      style: {},
      focus() { focus.node = node; },
      click() { node.dispatchEvent({ type: 'click' }); },
      scrollIntoView() {},
      setPointerCapture() {},
      getBoundingClientRect() {
        node._measures += 1;
        return { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20, x: 0, y: 0 };
      },
      addEventListener(type, fn) {
        if (!node._listeners) node._listeners = {};
        (node._listeners[type] ||= []).push(fn);
      },
      removeEventListener() {},
      dispatchEvent(event) {
        const next = event && typeof event === 'object' ? event : { type: event };
        if (next.target == null) next.target = node;
        if (typeof next.stopPropagation !== 'function') next.stopPropagation = () => { next.cancelBubble = true; };
        if (typeof next.preventDefault !== 'function') next.preventDefault = () => { next.defaultPrevented = true; };
        let current = node;
        while (current) {
          next.currentTarget = current;
          const list = current._listeners && current._listeners[next.type];
          if (list) list.slice().forEach((fn) => fn(next));
          if (next.cancelBubble) break;
          current = current.parentElement;
        }
        return true;
      },
      setAttribute(name, value) {
        node.attributes.set(name, String(value));
        if (name === 'id') node.id = String(value);
        if (name === 'class') node.className = String(value);
      },
      getAttribute(name) {
        if (node.attributes.has(name)) return node.attributes.get(name);
        if (name === 'id') return node.id || null;
        if (name === 'src') return node.src || null;
        return null;
      },
      removeAttribute(name) {
        node.attributes.delete(name);
        if (name === 'id') node.id = '';
      },
      appendChild(child) { return adopt(node, child); },
      append(...kids) { kids.forEach((kid) => node.appendChild(kid)); },
      replaceChildren(...kids) {
        node.replacements += 1;
        [...node.children].forEach((child) => child.remove());
        kids.flat().forEach((kid) => { if (kid && kid.nodeType !== 3) node.appendChild(kid); });
      },
      insertBefore(child, anchor) {
        if (!child || child.nodeType === 3) return child;
        if (child.parentElement) child.remove();
        child.parentElement = node;
        child.parentNode = node;
        const at = anchor ? node.children.indexOf(anchor) : -1;
        if (at < 0) node.children.push(child);
        else node.children.splice(at, 0, child);
        if (node._shadow) stamp(child, node._shadow);
        return child;
      },
      remove() {
        const parent = node.parentElement;
        if (!parent) return;
        parent.children = parent.children.filter((child) => child !== node);
        node.parentElement = null;
        node.parentNode = null;
      },
      querySelector(selector) { return collect(node, selector)[0] || null; },
      querySelectorAll(selector) { return collect(node, selector); },
      closest() { return null; },
      matches() { return false; },
      contains(other) {
        let current = other;
        while (current) {
          if (current === node) return true;
          current = current.parentElement;
        }
        return false;
      },
      cloneNode(deep) {
        const copy = make(tag, { className: node.className, hidden: node.hidden, dataset: { ...node.dataset }, value: node.value, type: node.type, textContent: node.textContent }, false);
        copy.id = node.id;
        copy.textContent = node.textContent;
        copy.disabled = node.disabled;
        copy.maxLength = node.maxLength;
        copy.autocomplete = node.autocomplete;
        node.attributes.forEach((value, name) => copy.setAttribute(name, value));
        if (deep) node.children.forEach((child) => copy.appendChild(child.cloneNode(true)));
        return copy;
      },
      attachShadow() {
        const shadow = {
          host: node,
          children: [],
          appendChild(child) {
            if (!child || child.nodeType === 3) return child;
            if (child.parentElement) child.remove();
            child.parentElement = null;
            child.parentNode = null;
            stamp(child, shadow);
            shadow.children.push(child);
            return child;
          },
          replaceChildren(...kids) {
            shadow.children = [];
            kids.flat().forEach((kid) => { if (kid) shadow.appendChild(kid); });
          },
          querySelector() { return null; },
          querySelectorAll() { return []; },
        };
        node.shadowRoot = shadow;
        return shadow;
      },
      getRootNode() {
        let current = node;
        while (current.parentElement) current = current.parentElement;
        return current._shadow || document;
      },
    };
    node.style = {
      setProperty(name, value) { node.style[name] = value; },
      removeProperty(name) { delete node.style[name]; },
      getPropertyValue(name) { return node.style[name] || ''; },
    };
    node.classList = classListOf(node);
    Object.defineProperty(node, 'nextSibling', {
      get() {
        const kids = node.parentElement?.children || [];
        const at = kids.indexOf(node);
        return at >= 0 ? kids[at + 1] || null : null;
      },
    });
    if (props.id) {
      node.id = props.id;
      if (register) ids.set(props.id, node);
    }
    if (node.id === 'usericon-canvas' || node.id === 'wallpaper-canvas') {
      const wide = node.id === 'usericon-canvas' ? 120 : 100;
      node.getBoundingClientRect = () => {
        node._measures += 1;
        return { left: 0, top: 0, right: wide, bottom: wide, width: wide, height: wide, x: 0, y: 0 };
      };
      node.getContext = () => node._ctx;
      node._ctx = {
        clearRect() {},
        drawImage(image, ox, oy, dw, dh) { node._draws.push({ image, ox, oy, dw, dh }); },
      };
    }
    return node;
  }
  const body = make('body');
  const documentElement = make('html');
  documentElement.appendChild(body);
  const document = {
    title: '',
    readyState: 'complete',
    body,
    documentElement,
    createElement: (tag) => make(tag),
    createDocumentFragment() {
      const fragment = make('fragment', {}, false);
      fragment.nodeType = 11;
      return fragment;
    },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    getElementById(id) {
      if (ids.has(id)) return ids.get(id);
      const node = make('div', { id });
      body.appendChild(node);
      return node;
    },
    querySelector(selector) { return collect(body, selector)[0] || null; },
    querySelectorAll(selector) { return collect(body, selector); },
    addEventListener() {},
    dispatchEvent() { return true; },
  };
  const phone = make('div', { id: 'fake-phone', className: 'phone-shell' });
  const status = make('div', { className: 'phone-status' });
  status.appendChild(make('span', { id: 'status-time', className: 'status-time' }));
  const dock = make('div', { id: 'phone-dock', className: 'phone-dock' });
  phone.append(make('div', { id: 'fake-wallpaper', className: 'wallpaper' }), status, dock);
  const notes = make('div', { id: 'fake-notes', className: 'notes-landing', hidden: true });
  notes.append(
    make('button', { id: 'fake-notes-back', className: 'notes-back', hidden: true }),
    make('h2', { id: 'fake-notes-title' }),
    make('div', { className: 'notes-search' }),
    make('div', { className: 'notes-folder-row' }),
    make('div', { id: 'fake-notes-body', className: 'notes-landing-body' }),
    make('button', { id: 'fake-notes-home', className: 'notes-home-bar' }),
  );
  const fakeHome = make('div', { id: 'fake-home', className: 'screen fake-home', hidden: true });
  fakeHome.append(phone, notes);
  const decoHome = make('div', { id: 'deco-pv-home', className: 'pv-stage', dataset: { pvKind: 'home' } });
  const decoNotes = make('div', { id: 'deco-pv-notes', className: 'pv-stage', dataset: { pvKind: 'notes' }, hidden: true });
  const homeTab = make('button', { className: 'sv-tab on', dataset: { pv: 'home' } });
  const notesTab = make('button', { className: 'sv-tab', dataset: { pv: 'notes' } });
  const deco = make('section', { id: 'view-deco', className: 'sv', dataset: { viewName: 'deco' } });
  deco.append(
    decoHome,
    decoNotes,
    homeTab,
    notesTab,
    make('input', { id: 'opt-icon-size', type: 'range', min: '80', max: '120', step: '2', value: '100' }),
    make('input', { id: 'opt-label-size', type: 'range', value: '13' }),
    make('input', { id: 'opt-bottom-gap', type: 'range', value: '0' }),
  );
  const advanced = make('section', { id: 'view-advanced', className: 'sv', dataset: { viewName: 'advanced' }, hidden: true });
  advanced.append(
    make('div', { id: 'adv-pv-notes', className: 'pv-stage', dataset: { pvKind: 'notes' } }),
    make('input', { id: 'opt-note-font', type: 'range', min: '14', max: '30', value: '17' }),
    make('select', { id: 'opt-note-line', value: 'normal' }),
    make('select', { id: 'opt-note-emphasis', value: 'none' }),
    make('p', { id: 'note-style-sample' }),
  );
  const settings = make('div', { id: 'settings' });
  settings.append(deco, advanced);
  for (const name of ['w1', 'w2', 'w3']) {
    settings.append(make('section', { id: `view-${name}`, className: 'sv', dataset: { viewName: name }, hidden: true }));
  }
  body.append(fakeHome, settings);
  function deepFind(root, pred, acc = []) {
    const visit = (node) => {
      if (!node || node.nodeType === 3) return;
      if (pred(node)) acc.push(node);
      (node.children || []).forEach(visit);
      (node.shadowRoot?.children || []).forEach(visit);
    };
    visit(root);
    return acc;
  }
  return { document, ids, focus, frames, get: (id) => ids.get(id), deepFind };
}

function urlShim() {
  const RealURL = globalThis.URL;
  function URLShim(value, base) { return new RealURL(value, base); }
  URLShim.createObjectURL = () => 'blob:crop';
  URLShim.revokeObjectURL = () => {};
  return URLShim;
}

async function bootChoice(dom, patch = {}, trail = '') {
  const logic = await import('../../zz4/logic.js');
  const manifest = await import('../../zz4/home-manifest.js');
  const lists = await import('../../zz4/builtin-lists.js');
  const noteBuilds = { n: 0 };
  let source = fs.readFileSync(new URL('../../zz4/app.js', import.meta.url), 'utf8');
  const marker = 'const gestureGuide';
  source = source.slice(source.indexOf(marker));
  source = source.replace(
    'function buildNoteScroller(items, choice, options, { zoomable = true } = {}) {\n',
    'function buildNoteScroller(items, choice, options, { zoomable = true } = {}) {\n  __noteBuilds.n += 1;\n',
  );
  source += trail;
  const sandbox = {
    ...logic,
    ...manifest,
    ...lists,
    __noteBuilds: noteBuilds,
    document: dom.document,
    history: { state: null, pushState() {}, replaceState() {}, back() {} },
    location: { protocol: 'file:', href: 'file:///zz4/', pathname: '/zz4/', hash: '', search: '' },
    navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0 },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    HTMLElement: class HTMLElement {},
    Option: class Option {
      constructor(text, value) {
        this.tagName = 'OPTION';
        this.textContent = String(text ?? '');
        this.value = String(value ?? '');
        this.children = [];
        this.nodeType = 1;
      }
    },
    Image: class Image {
      constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.onload = null;
        this.onerror = null;
      }
      set src(_value) {
        this.naturalWidth = 4000;
        this.naturalHeight = 3000;
        this.onload?.();
      }
    },
    URL: { createObjectURL() { return 'blob:crop'; }, revokeObjectURL() {} },
    requestAnimationFrame(fn) { dom.frames.push(fn); return dom.frames.length; },
    cancelAnimationFrame() {},
    setTimeout() { return 0; },
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    fetch() { return Promise.reject(new Error('offline')); },
  };
  Object.assign(sandbox, patch);
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'zz4/app.js' });
  return { noteBuilds, sandbox, flush() { const queued = dom.frames.splice(0); queued.forEach((fn) => fn()); } };
}

test('icon-size drag makes zero buildNoteScroller calls', async () => {
  const dom = choiceHarness();
  const { noteBuilds, flush } = await bootChoice(dom);
  assert.equal(noteBuilds.n, 0, 'hidden note previews are not built at startup');
  const icon = dom.get('opt-icon-size');
  for (const value of [80, 90, 100, 110, 120, 86]) {
    icon.value = String(value);
    icon.dispatchEvent({ type: 'input' });
  }
  assert.equal(dom.frames.length, 1, 'icon-size input coalesces to one frame');
  flush();
  assert.equal(noteBuilds.n, 0);
  const home = dom.deepFind(dom.get('deco-pv-home'), (node) => String(node.className).split(/\s+/).includes('pv-home'))[0];
  assert.equal(home.style['--icon-scale'], '0.86');

  const font = dom.get('opt-note-font');
  font.value = '22';
  font.dispatchEvent({ type: 'input' });
  flush();
  assert.equal(noteBuilds.n, 0, 'a hidden note preview is not rebuilt while it stays hidden');
  dom.deepFind(dom.document.body, (node) => node.className === 'sv-tab' && node.dataset.pv === 'notes')[0].dispatchEvent({ type: 'click' });
  assert.equal(dom.get('deco-pv-notes').hidden, false);
  assert.equal(noteBuilds.n, 1, 'the hidden preview is built once, just before it is shown');
  const lines = dom.deepFind(dom.get('deco-pv-notes'), (node) => String(node.className).split(/\s+/).includes('notes-lines'))[0];
  assert.equal(lines.style.getPropertyValue('--note-size'), '22px');

  dom.deepFind(dom.document.body, (node) => String(node.className || '').split(/\s+/).includes('sv-tab') && node.dataset?.pv === 'home')[0].dispatchEvent({ type: 'click' });
  font.value = '28';
  font.dispatchEvent({ type: 'input' });
  flush();
  assert.equal(noteBuilds.n, 1, 'hiding the preview again does not rebuild it');
  dom.deepFind(dom.document.body, (node) => node.dataset?.pv === 'notes' && String(node.className || '').split(/\s+/).includes('sv-tab'))[0].dispatchEvent({ type: 'click' });
  assert.equal(noteBuilds.n, 1, 'showing it again updates the existing lines');
  assert.equal(lines.style.getPropertyValue('--note-size'), '28px');
  icon.value = '110';
  icon.dispatchEvent({ type: 'input' });
  flush();
  assert.equal(noteBuilds.n, 1, 'a later icon-size drag still does not rebuild note scrollers');
});

test('sample-number change with 100 items replaces zero rows', async () => {
  const dom = choiceHarness();
  await bootChoice(dom);
  dom.get('new-list').dispatchEvent({ type: 'click' });
  dom.get('wz-title').value = '백개 목록';
  dom.get('wz-next1').dispatchEvent({ type: 'click' });
  dom.get('wz-items').value = Array.from({ length: 100 }, (_, index) => `항목${index + 1}`).join('\n');
  dom.get('wz-next2').dispatchEvent({ type: 'click' });
  const picks = dom.get('wz-picks');
  assert.equal(picks.children.length, 100);
  const built = picks.replacements;
  const rows = picks.children.slice();
  picks.children[0].dispatchEvent({ type: 'click' });
  assert.equal(picks.replacements, built, 'choosing the target does not rebuild the list');
  assert.equal(picks.children[0], rows[0]);
  for (let step = 0; step < 20; step += 1) dom.get('wz-plus').dispatchEvent({ type: 'click' });
  assert.equal(dom.get('wz-num').textContent, '21');
  assert.equal(picks.replacements, built);
  assert.equal(picks.children.length, 100);
  assert.deepEqual(picks.children, rows, 'sample ± keeps every picker row');
  assert.ok(dom.get('wz-pv-lines').children.length > 0, 'the small preview still updates');

  dom.get('wz-edit-toggle').dispatchEvent({ type: 'click' });
  assert.equal(picks.children.length, 100);
  const edited = picks.replacements;
  const editRows = picks.children.slice();
  const firstInput = editRows[0].querySelector('input');
  const secondInput = editRows[1].querySelector('input');
  firstInput.value = '고쳐 둔 항목';
  firstInput.dispatchEvent({ type: 'input' });
  firstInput.focus();
  for (let step = 0; step < 5; step += 1) dom.get('wz-minus').dispatchEvent({ type: 'click' });
  assert.equal(picks.replacements, edited);
  assert.equal(firstInput.value, '고쳐 둔 항목');
  assert.equal(dom.focus.node, firstInput, 'sample ± keeps the focused field');
  editRows[0].querySelector('[data-act="down"]').dispatchEvent({ type: 'click' });
  assert.equal(picks.replacements, edited, 'moving a row does not rebuild the list');
  assert.equal(picks.children[1], editRows[0]);
  assert.equal(picks.children[0], editRows[1]);
  assert.equal(firstInput.value, '고쳐 둔 항목');
  assert.equal(dom.focus.node, editRows[0].querySelector('[data-act="down"]'));
  editRows[1].querySelector('[data-act="del"]').dispatchEvent({ type: 'click' });
  assert.equal(picks.replacements, edited, 'removing a row does not rebuild the list');
  assert.equal(picks.children.length, 99);
  assert.equal(picks.children.includes(editRows[1]), false);
  assert.equal(editRows[1].parentElement, null);
  assert.equal(secondInput.value, '항목2');
  assert.ok(picks.children.includes(editRows[0]));
});

test('step 3 with 100 items inserts the pick list once and does not read layout per row', async () => {
  const dom = choiceHarness();
  let watchLayout = false;
  let layoutReads = 0;
  function watch(node) {
    if (!node || node.nodeType === 3 || node._layoutWatched) return node;
    node._layoutWatched = true;
    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect.bind(node) : null;
    if (rect) {
      node.getBoundingClientRect = () => {
        if (watchLayout) layoutReads += 1;
        return rect();
      };
    }
    const scroll = typeof node.scrollIntoView === 'function' ? node.scrollIntoView.bind(node) : null;
    if (scroll) {
      node.scrollIntoView = () => {
        if (watchLayout) layoutReads += 1;
        return scroll();
      };
    }
    for (const prop of ['offsetHeight', 'offsetWidth']) {
      let stored = 0;
      Object.defineProperty(node, prop, {
        configurable: true,
        get() { if (watchLayout) layoutReads += 1; return stored; },
        set(value) { stored = value; },
      });
    }
    const clone = typeof node.cloneNode === 'function' ? node.cloneNode.bind(node) : null;
    if (clone) node.cloneNode = (deep) => watch(clone(deep));
    return node;
  }
  const origCreate = dom.document.createElement.bind(dom.document);
  dom.document.createElement = (tag) => watch(origCreate(tag));
  await bootChoice(dom);
  const picks = dom.get('wz-picks');
  watch(picks);
  let insertions = 0;
  const origAppend = picks.appendChild.bind(picks);
  const origInsert = picks.insertBefore.bind(picks);
  picks.appendChild = (child) => { insertions += 1; return origAppend(child); };
  picks.insertBefore = (child, anchor) => { insertions += 1; return origInsert(child, anchor); };

  dom.get('new-list').dispatchEvent({ type: 'click' });
  dom.get('wz-title').value = '백개 목록';
  dom.get('wz-next1').dispatchEvent({ type: 'click' });
  dom.get('wz-items').value = Array.from({ length: 100 }, (_, index) => `항목${index + 1}`).join('\n');
  dom.get('wz-items').dispatchEvent({ type: 'input' });
  insertions = 0;
  layoutReads = 0;
  watchLayout = true;
  dom.get('wz-next2').dispatchEvent({ type: 'click' });
  watchLayout = false;

  assert.equal(insertions, 1, 'the 100 pick rows go in through one list-container insertion');
  assert.equal(layoutReads, 0, 'building the rows does not read layout');
  assert.equal(picks.children.length, 100);
  assert.equal(picks.children.some((child) => child.nodeType === 11), false);
  const first = picks.children[0];
  const last = picks.children[99];
  assert.equal(first.tagName, 'BUTTON');
  assert.equal(first.className, 'sv-pick');
  assert.equal(first.getAttribute('role'), 'radio');
  assert.equal(first.getAttribute('aria-checked'), 'false');
  assert.equal(first.children[0].className, 'n');
  assert.equal(first.children[0].textContent, '1');
  assert.equal(first.children[1].className, 'x');
  assert.equal(first.children[1].textContent, '항목1');
  assert.equal(first.children[2].className, 'tg');
  assert.equal(first.children[2].textContent, '예언');
  assert.equal(last.children[0].textContent, '100');
  assert.equal(last.children[1].textContent, '항목100');
  const built = insertions;
  first.dispatchEvent({ type: 'click' });
  assert.equal(insertions, built, 'choosing a row does not insert again');
  assert.equal(first.getAttribute('aria-checked'), 'true');
  assert.equal(picks.children[1].getAttribute('aria-checked'), 'false');
});

test('photo cropper draws at most once per frame', async () => {
  const dom = choiceHarness();
  const { flush } = await bootChoice(dom);
  const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });
  async function load(id) {
    const input = dom.get(id);
    input.files = [{}];
    input.dispatchEvent({ type: 'change' });
    await settle();
    await settle();
  }
  function drag(canvas, x0, y0, points) {
    const before = canvas._draws.length;
    const measured = canvas._measures;
    canvas.dispatchEvent({ type: 'pointerdown', pointerId: 1, clientX: x0, clientY: y0 });
    assert.equal(canvas._measures, measured + 1);
    for (const point of points) {
      canvas.dispatchEvent({ type: 'pointermove', pointerId: 1, clientX: point[0], clientY: point[1] });
    }
    assert.equal(canvas._draws.length, before, 'moves before the frame do not draw');
    assert.equal(canvas._measures, measured + 1, 'drag reuses the geometry measured on pointerdown');
    assert.equal(dom.frames.length, 1);
    flush();
    assert.equal(canvas._draws.length, before + 1);
    return canvas._draws.at(-1);
  }

  await load('usericon-file');
  const icon = dom.get('usericon-canvas');
  assert.equal(icon._draws.length, 1);
  const iconDraw = drag(icon, 30, 40, [[26, 40], [22, 40], [18, 40], [14, 40], [10, 40], [6, 40], [2, 40], [-2, 40]]);
  const iconCover = 240 / Math.min(iconDraw.image.naturalWidth, iconDraw.image.naturalHeight);
  assert.equal(iconDraw.dw, iconDraw.image.naturalWidth * iconCover);
  assert.equal(iconDraw.dh, iconDraw.image.naturalHeight * iconCover);
  assert.equal(iconDraw.image.naturalWidth, 4000);
  assert.equal(typeof iconDraw.image.getContext, 'undefined');
  const again = drag(icon, -2, 40, [[-6, 36], [-10, 32], [-14, 28]]);
  assert.equal(again.image, iconDraw.image);
  assert.equal(again.dw, iconDraw.dw);

  await load('wallpaper-file');
  const wall = dom.get('wallpaper-canvas');
  const wallDraw = drag(wall, 40, 80, [[36, 70], [32, 60], [28, 50], [24, 40], [20, 30]]);
  const wallCover = Math.max(200 / wallDraw.image.naturalWidth, 433 / wallDraw.image.naturalHeight);
  assert.ok(Math.abs(wallDraw.dw - wallDraw.image.naturalWidth * wallCover) < 1e-6);
  assert.ok(Math.abs(wallDraw.dh - wallDraw.image.naturalHeight * wallCover) < 1e-6);
  assert.equal(wallDraw.image.naturalWidth, 4000);
  assert.notEqual(wallDraw.image, iconDraw.image);
});

async function settleVm() {
  await new Promise((resolve) => { setImmediate(resolve); });
  await new Promise((resolve) => { setImmediate(resolve); });
}

test('artwork warm-up waits for a controller and retries', async () => {
  const dom = choiceHarness();
  const calls = [];
  const timers = [];
  const listeners = [];
  let controller = null;
  let resolveReady = () => {};
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const scope = 'https://play.test/zz4/';
  const failing = new URL('home-icons/a1.svg', scope).href;
  const worker = {
    get controller() { return controller; },
    ready,
    addEventListener(type, fn) { if (type === 'controllerchange') listeners.push(fn); },
    removeEventListener() {},
    register() { return Promise.resolve(); },
    getRegistration() { return Promise.resolve(null); },
  };
  await bootChoice(dom, {
    location: { protocol: 'https:', href: scope, pathname: '/zz4/', hash: '', search: '' },
    navigator: { userAgent: 'test', platform: 'test', maxTouchPoints: 0, serviceWorker: worker },
    fetch(url) {
      const href = String(url);
      calls.push(href);
      if (href === failing && calls.filter((item) => item === href).length < 3) return Promise.reject(new Error('miss'));
      return Promise.resolve({ ok: true });
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms: Number(ms) || 0 });
      return timers.length;
    },
    clearTimeout() {},
    URL: urlShim(),
  });
  await settleVm();
  resolveReady();
  await settleVm();
  assert.equal(calls.length, 0, 'navigator.serviceWorker.ready without a controller does not fetch');
  assert.equal(timers.length, 0, 'warm-up does not use a single timed attempt');
  controller = { scriptURL: './sw.js' };
  listeners.forEach((fn) => fn({ type: 'controllerchange' }));
  await settleVm();
  const manifest = await import('../../zz4/home-manifest.js');
  const urls = manifest.manifestFiles().map((file) => new URL(manifest.iconSrc(file), scope).href);
  assert.equal(urls.length, 55);
  assert.equal(new Set(calls).size, 55, 'every artwork file is requested once a controller exists');
  assert.deepEqual([...new Set(calls)].sort(), [...urls].sort());
  assert.equal(calls.filter((href) => href === failing).length, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 300);
  const first = timers.splice(0, timers.length);
  first[0].fn();
  await settleVm();
  assert.equal(calls.filter((href) => href === failing).length, 2);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 600);
  const second = timers.splice(0, timers.length);
  second[0].fn();
  await settleVm();
  assert.equal(calls.filter((href) => href === failing).length, 3);
  assert.equal(timers.length, 0, 'a file stops after 3 tries');
});

test('visible check view updates readiness when artwork warm-up finishes', async () => {
  const dom = choiceHarness();
  const check = dom.document.createElement('section');
  check.className = 'sv';
  check.dataset.viewName = 'check';
  check.hidden = true;
  dom.get('settings').appendChild(check);
  const scope = 'https://play.test/zz4/';
  const manifest = await import('../../zz4/home-manifest.js');
  const urls = manifest.manifestFiles().map((file) => new URL(manifest.iconSrc(file), scope).href);
  const prefix = 'choice-shell-' + encodeURIComponent(scope) + '-';
  const stored = new Set();
  const stores = new Map([[prefix + 'v20261010-choice-perf-1-coherent-1-compat-1-wake-1-ready-1', stored]]);
  const pendingFetches = [];
  let resolveReady = () => {};
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const controller = { scriptURL: './sw.js' };
  const booted = await bootChoice(dom, {
    location: { protocol: 'https:', href: scope, pathname: '/zz4/', hash: '', search: '' },
    navigator: {
      userAgent: 'test',
      platform: 'test',
      maxTouchPoints: 0,
      serviceWorker: {
        get controller() { return controller; },
        ready,
        addEventListener() {},
        getRegistration() { return Promise.resolve({ active: { state: 'activated' }, scope }); },
        register() { return Promise.resolve(); },
      },
    },
    caches: {
      keys() { return Promise.resolve([...stores.keys()]); },
      open(name) {
        const set = stores.get(name);
        return Promise.resolve({
          match(url) { return Promise.resolve(set && set.has(String(url)) ? { ok: true } : undefined); },
        });
      },
    },
    fetch(url) {
      return new Promise((resolve) => { pendingFetches.push({ url: String(url), resolve }); });
    },
    URL: urlShim(),
  }, `
    globalThis.__checkOpens = 0;
    const __showView = showView;
    showView = (name, options) => {
      if (name === 'check') globalThis.__checkOpens += 1;
      return __showView(name, options);
    };
    globalThis.__openCheck = () => showView('check');
    globalThis.__readyLine = () => {
      const list = document.getElementById('precheck-list');
      const kids = list.children || [];
      for (let index = 0; index < kids.length; index += 1) {
        if (String(kids[index].textContent || '').indexOf('오프라인 저장:') === 0) return kids[index];
      }
      return null;
    };
  `);
  booted.sandbox.__openCheck();
  await settleVm();
  const line = booted.sandbox.__readyLine();
  const pendingText = '오프라인 저장: 아직 준비되지 않았습니다. 인터넷이 연결된 상태에서 한 번 더 열어 주세요.';
  assert.ok(line, 'the check view rendered a readiness line');
  assert.equal(line.textContent, pendingText);
  assert.equal(line.dataset.tone, 'warn');
  const list = line.parentElement;
  const nodes = list.children.slice();
  const rest = nodes.filter((node) => node !== line).map((node) => node.textContent);
  const builds = list.replacements;
  assert.equal(booted.sandbox.__checkOpens, 1);
  assert.equal(check.hidden, false);
  assert.ok(rest.length > 0);

  resolveReady();
  await settleVm();
  assert.equal(pendingFetches.length, urls.length, 'warm-up is in flight while the check view stays open');
  assert.equal(booted.sandbox.__readyLine(), line);
  assert.equal(line.textContent, pendingText);
  assert.equal(list.replacements, builds);

  urls.forEach((url) => stored.add(url));
  pendingFetches.forEach((item) => item.resolve({ ok: true }));
  await settleVm();
  assert.equal(line.textContent, '오프라인 저장: 준비됨');
  assert.equal(line.dataset.tone, 'ok');
  assert.equal(booted.sandbox.__readyLine(), line, 'the same readiness row is updated');
  assert.equal(list.replacements, builds, 'the readiness line changes without rebuilding the check list');
  assert.equal(booted.sandbox.__checkOpens, 1, 'the check view is not reopened');
  assert.equal(check.hidden, false);
  assert.equal(list.children.length, nodes.length);
  nodes.forEach((node, index) => assert.equal(list.children[index], node));
  assert.deepEqual(nodes.filter((node) => node !== line).map((node) => node.textContent), rest);
});

test('readiness is false while any artwork is missing', async () => {
  const scope = 'https://play.test/zz4/';
  const manifest = await import('../../zz4/home-manifest.js');
  const urls = manifest.manifestFiles().map((file) => new URL(manifest.iconSrc(file), scope).href);
  assert.equal(urls.length, 55);
  const prefix = 'choice-shell-' + encodeURIComponent(scope) + '-';
  const foreignName = 'choice-shell-' + encodeURIComponent('https://play.test/zz5/') + '-v1';
  const ours = new Set(urls.slice(1));
  const stores = new Map([
    [prefix + 'v20261010-choice-perf-1', ours],
    [foreignName, new Set(urls)],
  ]);
  let globalMatch = 0;
  let workerState = 'activated';
  const caches = {
    keys() { return Promise.resolve([...stores.keys()]); },
    open(name) {
      const set = stores.get(name);
      return Promise.resolve({
        match(url) { return Promise.resolve(set && set.has(String(url)) ? { ok: true } : undefined); },
      });
    },
    match() { globalMatch += 1; return Promise.resolve({ ok: true }); },
  };
  const dom = choiceHarness();
  const booted = await bootChoice(dom, {
    location: { protocol: 'https:', href: scope, pathname: '/zz4/', hash: '', search: '' },
    navigator: {
      userAgent: 'test',
      platform: 'test',
      maxTouchPoints: 0,
      serviceWorker: {
        controller: { state: 'activated' },
        ready: Promise.resolve(),
        addEventListener() {},
        getRegistration() { return Promise.resolve({ active: { get state() { return workerState; } }, scope }); },
        register() { return Promise.resolve(); },
      },
    },
    caches,
    fetch() { return Promise.resolve({ ok: true }); },
    URL: urlShim(),
  }, '\nglobalThis.__artworkReady = async () => (await checkOfflineReady()) === "ready";\n');
  assert.equal(await booted.sandbox.__artworkReady(), false);
  assert.equal(globalMatch, 0, 'a global caches.match must not count another app\'s cache');
  ours.add(urls[0]);
  assert.equal(await booted.sandbox.__artworkReady(), true);
  ours.delete(urls[0]);
  assert.equal(await booted.sandbox.__artworkReady(), false, 'one missing artwork keeps readiness false');
  ours.add(urls[0]);
  workerState = 'installing';
  assert.equal(await booted.sandbox.__artworkReady(), false);
});

test('the watchdog does nothing when the network probe is rejected', async () => {
  const html = fs.readFileSync(new URL('../../zz4/index.html', import.meta.url), 'utf8');
  const match = html.match(/<script id="choice-repair">([\s\S]*?)<\/script>/);
  assert.ok(match, 'choice repair script');
  const scope = 'http://127.0.0.1:18741/zz4/';
  const prefix = 'choice-shell-' + encodeURIComponent(scope) + '-';
  const foreign = 'choice-shell-' + encodeURIComponent('http://127.0.0.1:18741/zz5/') + '-v1';
  const names = [prefix + 'v20261010-choice-perf-1', prefix + 'old', foreign, 'notes-cache-v1'];
  const deleted = [];
  const fetches = [];
  const timers = [];
  let reloads = 0;
  let unregisters = 0;
  let storageReads = 0;
  const session = new Map();
  const listeners = new Map();
  const document = {
    documentElement: { getAttribute() { return null; } },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((fn) => fn(event));
      return true;
    },
  };
  const sandbox = {
    Promise,
    URL: globalThis.URL,
    encodeURIComponent: globalThis.encodeURIComponent,
    document,
    sessionStorage: {
      getItem(key) { return session.has(key) ? session.get(key) : null; },
      setItem(key, value) { session.set(key, String(value)); },
      removeItem(key) { session.delete(key); },
    },
    location: {
      href: scope + 'index.html',
      reload() { reloads += 1; },
    },
    navigator: {
      serviceWorker: {
        getRegistration() { return Promise.resolve({ scope }); },
        getRegistrations() {
          unregisters += 1;
          return Promise.resolve([
            { scope, unregister() { unregisters += 1; return Promise.resolve(true); } },
            { scope: 'http://127.0.0.1:18741/zz5/', unregister() { unregisters += 1; return Promise.resolve(true); } },
          ]);
        },
      },
    },
    caches: {
      keys() { return Promise.resolve(names.slice()); },
      delete(name) { deleted.push(name); return Promise.resolve(true); },
    },
    fetch(url, options) {
      fetches.push({ url: String(url), cache: options && options.cache });
      return Promise.reject(new Error('offline'));
    },
    Date,
    setTimeout(fn, ms) { timers.push({ fn, ms: Number(ms) || 0 }); return timers.length; },
    clearTimeout() {},
  };
  Object.defineProperty(sandbox, 'localStorage', { get() { storageReads += 1; throw new Error('localStorage'); } });
  Object.defineProperty(sandbox, 'indexedDB', { get() { storageReads += 1; throw new Error('indexedDB'); } });
  sandbox.window = sandbox;
  vm.runInNewContext(match[1], sandbox, { filename: 'zz4/index.html' });
  assert.equal(timers.length, 0, 'the watchdog stays disarmed until the module starts');
  document.dispatchEvent({ type: 'choice-module-start' });
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 3000);
  assert.equal(deleted.length, 0);
  timers[0].fn();
  await settleVm();
  assert.deepEqual(deleted, []);
  assert.equal(fetches.length, 1);
  assert.match(fetches[0].url, /^sw\.js\?probe=\d+$/);
  assert.equal(fetches[0].cache, 'no-store');
  assert.equal(reloads, 0);
  assert.equal(unregisters, 0);
  assert.equal(session.has('choice-self-repair'), false);
  assert.equal(storageReads, 0);
});

function previewSelectorParts(selector) {
  const raw = [];
  let buf = '';
  const flush = () => {
    if (!buf.trim()) return;
    raw.push(buf.trim());
    buf = '';
  };
  for (const ch of selector) {
    if (ch === '>' || ch === ' ' || ch === '\n' || ch === '\t') {
      flush();
      if (ch === '>') raw.push('>');
    } else buf += ch;
  }
  flush();
  const parts = [];
  let combinator = ' ';
  for (const token of raw) {
    if (token === '>') { combinator = '>'; continue; }
    parts.push({ combinator, sel: token });
    combinator = ' ';
  }
  return parts;
}

function previewMatches(el, selector) {
  let rest = selector.trim();
  if (!el || !rest) return false;
  if (rest === '*') return true;
  if (/^[A-Za-z][\w-]*/.test(rest)) {
    const tag = rest.match(/^[A-Za-z][\w-]*/)[0];
    if (String(el.tagName || '').toUpperCase() !== tag.toUpperCase()) return false;
    rest = rest.slice(tag.length);
  }
  if (!rest) return true;
  while (rest) {
    if (rest[0] === '#') {
      const matched = rest.match(/^#([A-Za-z0-9_-]+)/);
      if (!matched || el.id !== matched[1]) return false;
      rest = rest.slice(matched[0].length);
    } else if (rest[0] === '.') {
      const matched = rest.match(/^\.([A-Za-z0-9_-]+)/);
      if (!matched || !String(el.className || '').split(/\s+/).includes(matched[1])) return false;
      rest = rest.slice(matched[0].length);
    } else if (rest[0] === '[') {
      const matched = rest.match(/^\[([A-Za-z0-9_-]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]/);
      if (!matched) return false;
      const actual = el.getAttribute(matched[1]);
      if (matched[2]) { if (actual !== matched[3]) return false; }
      else if (actual == null) return false;
      rest = rest.slice(matched[0].length);
    } else return false;
  }
  return true;
}

function previewMatchesChain(el, selector) {
  const parts = previewSelectorParts(selector);
  if (!parts.length || !previewMatches(el, parts[parts.length - 1].sel)) return false;
  let current = el;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const combinator = parts[index + 1].combinator;
    if (combinator === '>') {
      current = current.parentElement;
      if (!current || !previewMatches(current, parts[index].sel)) return false;
    } else {
      let parent = current.parentElement;
      let found = null;
      while (parent) {
        if (previewMatches(parent, parts[index].sel)) { found = parent; break; }
        parent = parent.parentElement;
      }
      if (!found) return false;
      current = found;
    }
  }
  return true;
}

function previewQueryAll(root, selector) {
  const groups = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
  const found = [];
  const visit = (node) => {
    for (const child of node.children || []) {
      if (!child || child.nodeType === 3) continue;
      if (groups.some((group) => previewMatchesChain(child, group))) found.push(child);
      visit(child);
    }
  };
  visit(root);
  return found;
}

function mountPreview({ app, pathname, build }) {
  const draws = [];
  const stats = { shadows: 0 };
  const frames = [];
  function previewElement(tag) {
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      nodeType: 1,
      id: '',
      className: '',
      hidden: false,
      disabled: false,
      inert: false,
      type: '',
      value: '',
      min: '',
      max: '',
      step: '',
      width: 0,
      height: 0,
      dataset: {},
      attributes: [],
      children: [],
      parentElement: null,
      parentNode: null,
      clientWidth: 180,
      clientHeight: 390,
      clientLeft: 0,
      clientTop: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      style: {
        setProperty(name, value) { this[name] = value; },
        removeProperty(name) { delete this[name]; },
        getPropertyValue(name) { return this[name] || ''; },
      },
      focus() {},
      setAttribute(name, value) {
        const found = el.attributes.find((attr) => attr.name === name);
        if (found) found.value = String(value);
        else el.attributes.push({ name, value: String(value) });
        if (name === 'id') el.id = String(value);
        if (name === 'class') el.className = String(value);
      },
      getAttribute(name) {
        const found = el.attributes.find((attr) => attr.name === name);
        if (found) return found.value;
        if (name === 'id' && el.id) return el.id;
        if (name === 'class' && el.className) return el.className;
        return null;
      },
      removeAttribute(name) {
        const index = el.attributes.findIndex((attr) => attr.name === name);
        if (index >= 0) el.attributes.splice(index, 1);
        if (name === 'id') el.id = '';
      },
      appendChild(child) {
        if (!child || child.nodeType === 3) return child;
        if (child.parentElement && child.parentElement !== el) child.remove();
        child.parentElement = el;
        child.parentNode = el;
        if (!el.children.includes(child)) el.children.push(child);
        return child;
      },
      replaceChildren(...kids) {
        for (const child of el.children) {
          child.parentElement = null;
          child.parentNode = null;
        }
        el.children = [];
        kids.forEach((kid) => { if (kid) el.appendChild(kid); });
      },
      remove() {
        const parent = el.parentElement;
        if (!parent) return;
        parent.children = parent.children.filter((child) => child !== el);
        el.parentElement = null;
        el.parentNode = null;
      },
      querySelector(selector) { return previewQueryAll(el, selector)[0] || null; },
      querySelectorAll(selector) { return previewQueryAll(el, selector); },
      closest(selector) {
        const groups = String(selector).split(',').map((part) => part.trim()).filter(Boolean);
        let current = el;
        while (current && current.nodeType === 1) {
          if (groups.some((group) => previewMatchesChain(current, group))) return current;
          current = current.parentElement;
        }
        return null;
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 412, bottom: 220, width: 412, height: 220, x: 0, y: 0 };
      },
      addEventListener(type, fn) { (el._listeners ||= {})[type] = (el._listeners[type] || []).concat(fn); },
      dispatchEvent(event) {
        (el._listeners?.[event.type] || []).forEach((fn) => fn(event));
        return true;
      },
      cloneNode(deep) {
        const copy = previewElement(tag);
        copy.id = el.id;
        copy.className = el.className;
        copy.hidden = el.hidden;
        copy.value = el.value;
        copy.type = el.type;
        copy.width = el.width;
        copy.height = el.height;
        copy.dataset = { ...el.dataset };
        copy.textContent = el.textContent;
        for (const attr of el.attributes) copy.setAttribute(attr.name, attr.value);
        if (deep) for (const child of el.children) copy.appendChild(child.cloneNode(true));
        return copy;
      },
      attachShadow() {
        stats.shadows += 1;
        const shadow = {
          children: [],
          host: el,
          appendChild(child) {
            if (!child) return child;
            if (child.parentElement) child.remove();
            child.parentElement = null;
            child.parentNode = shadow;
            shadow.children.push(child);
            return child;
          },
          querySelector(selector) { return previewQueryAll(shadow, selector)[0] || null; },
          querySelectorAll(selector) { return previewQueryAll(shadow, selector); },
        };
        el.shadowRoot = shadow;
        return shadow;
      },
    };
    let storedText = '';
    Object.defineProperty(el, 'textContent', {
      configurable: true,
      enumerable: true,
      get() {
        return el.children.length ? el.children.map((child) => child.textContent || '').join('') : storedText;
      },
      set(value) { storedText = value == null ? '' : String(value); },
    });
    Object.defineProperty(el, 'childElementCount', { get() { return el.children.length; } });
    if (el.tagName === 'CANVAS') {
      el.getContext = () => ({
        drawImage(source) { draws.push({ source, width: el.width, height: el.height, node: el }); },
      });
    }
    return el;
  }
  const body = previewElement('body');
  body.dataset.magicApp = app;
  build(previewElement, body);
  const document = {
    readyState: 'complete',
    body,
    documentElement: previewElement('html'),
    activeElement: null,
    styleSheets: [{ cssRules: [{ cssText: 'body{margin:0}' }] }],
    createElement: previewElement,
    createRange() {
      return {
        selectNodeContents() {},
        getBoundingClientRect() {
          return { left: 0, top: 0, right: 285, bottom: 80, width: 285, height: 80, x: 0, y: 0 };
        },
      };
    },
    querySelector(selector) { return previewQueryAll(body, selector)[0] || null; },
    querySelectorAll(selector) { return previewQueryAll(body, selector); },
    addEventListener() {},
    dispatchEvent() { return true; },
  };
  const sandbox = {
    document,
    location: { hash: '', search: '', pathname, origin: 'https://example.test' },
    navigator: { userAgent: 'test', platform: 'Mac', maxTouchPoints: 0 },
    history: { pushState() {}, replaceState() {}, back() {} },
    innerWidth: 412,
    innerHeight: 915,
    getComputedStyle() { return { color: '#111', font: '16px sans-serif', transformOrigin: '50% 50%', order: '0' }; },
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class Event { constructor(type) { this.type = type; } },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    addEventListener() {},
    setTimeout() { return 0; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInContext(settingsSource, vm.createContext(sandbox));
  const flush = () => { const queued = frames.splice(0); queued.forEach((fn) => fn()); };
  flush();
  function walk(node, fn) {
    if (!node || node.nodeType === 3) return;
    fn(node);
    for (const child of node.children || []) walk(child, fn);
  }
  return {
    draws,
    stats,
    flush,
    body,
    button(text) {
      let found = null;
      walk(body, (node) => {
        if (!found && node.tagName === 'BUTTON' && node.textContent === text) found = node;
      });
      return found;
    },
    phone() {
      let found = null;
      walk(body, (node) => {
        if (!found && node.className === 'magic-preview-phone') found = node;
      });
      return found;
    },
    ranges() {
      const inputs = [];
      walk(body, (node) => {
        if (node.tagName === 'INPUT' && node.type === 'range') inputs.push(node);
      });
      return inputs;
    },
  };
}

test('unlock clock preview survives repeated syncs', () => {
  let hour;
  let minute;
  const preview = mountPreview({
    app: 'unlock',
    pathname: '/zz2/',
    build(el, body) {
      const screen = el('div');
      screen.id = 'settings-screen';
      const inner = el('div');
      inner.className = 'settings-inner';
      screen.appendChild(inner);
      const lock = el('section');
      lock.id = 'time-lock';
      lock.hidden = true;
      const face = el('div');
      face.id = 'time-face';
      const date = el('div');
      date.id = 'time-date';
      const clock = el('time');
      clock.id = 'time-clock';
      hour = el('span');
      hour.id = 'time-hour';
      const colon = el('span');
      colon.className = 'time-colon';
      minute = el('span');
      minute.id = 'time-minute';
      clock.appendChild(hour);
      clock.appendChild(colon);
      clock.appendChild(minute);
      face.appendChild(date);
      face.appendChild(clock);
      const backdrop = el('div');
      backdrop.id = 'time-clock-backdrop';
      lock.appendChild(backdrop);
      lock.appendChild(face);
      body.appendChild(screen);
      body.appendChild(lock);
    },
  });
  preview.button('화면 커스텀').dispatchEvent({ type: 'click' });
  preview.flush();
  const select = previewQueryAll(preview.body, 'select')[0];
  assert.ok(select, 'element picker');
  select.value = 'clock';
  select.dispatchEvent({ type: 'change' });
  preview.flush();
  const surface = () => preview.phone().children.find((node) => node.className === 'magic-preview-surface');
  const read = () => {
    const root = surface().shadowRoot;
    return `${root.querySelector('#time-hour').textContent}:${root.querySelector('#time-minute').textContent}`;
  };
  assert.match(read(), /^\d{2}:\d{2}$/);
  const shown = surface().shadowRoot.querySelector('#time-hour');
  assert.notEqual(shown, hour);
  const ranges = preview.ranges();
  assert.ok(ranges.length >= 3);
  ranges[0].value = '140';
  ranges[0].dispatchEvent({ type: 'input' });
  preview.flush();
  for (let step = 0; step < 6; step += 1) {
    const input = ranges[(step % (ranges.length - 1)) + 1];
    input.value = String(Number(input.min) + (step % 4));
    input.dispatchEvent({ type: 'input' });
    preview.flush();
    assert.match(read(), /^\d{2}:\d{2}$/);
    assert.equal(surface().shadowRoot.querySelector('#time-hour'), shown, 'slider sync keeps the mounted clock');
  }
  assert.equal(hour.textContent, '');
  assert.equal(minute.textContent, '');
  assert.equal(preview.stats.shadows, 1);
  const scale = Number(surface().shadowRoot.querySelector('#time-face').style.scale);
  assert.ok(scale > 1.3 && scale < 1.45, `filled clock scale stays ${scale}`);
});

test('closing customize discards the mounted preview', () => {
  let home;
  let host;
  let canvas;
  const preview = mountPreview({
    app: 'choice',
    pathname: '/zz4/',
    build(el, body) {
      const settings = el('div');
      settings.id = 'settings';
      const shell = el('div');
      shell.className = 'shell';
      settings.appendChild(shell);
      host = el('div');
      host.id = 'home-host';
      host.setAttribute('data-mode', 'idle');
      home = el('div');
      home.id = 'fake-home';
      home.setAttribute('data-page', '0');
      canvas = el('canvas');
      canvas.id = 'stage-canvas';
      canvas.width = 120;
      canvas.height = 80;
      home.appendChild(canvas);
      host.appendChild(home);
      body.appendChild(settings);
      body.appendChild(host);
    },
  });
  const open = preview.button('화면 커스텀');
  open.dispatchEvent({ type: 'click' });
  preview.flush();
  const phone = preview.phone();
  const first = phone.children.find((node) => node.className === 'magic-preview-surface');
  const shadow = first.shadowRoot;
  assert.equal(shadow.querySelector('#fake-home').getAttribute('data-page'), '0');
  assert.equal(shadow.querySelector('#home-host').getAttribute('data-mode'), 'idle');
  assert.equal(shadow.querySelector('#stage-canvas').width, 120);
  assert.equal(preview.draws.length, 1);
  assert.equal(preview.draws[0].source, canvas);
  assert.equal(preview.stats.shadows, 1);
  home.setAttribute('data-page', 'notes');
  host.setAttribute('data-mode', 'live');
  canvas.width = 300;
  canvas.height = 180;
  const ranges = preview.ranges();
  ranges[0].value = '120';
  ranges[0].dispatchEvent({ type: 'input' });
  preview.flush();
  assert.equal(phone.children.find((node) => node.className === 'magic-preview-surface'), first, 'an open preview stays mounted');
  assert.equal(first.shadowRoot.querySelector('#fake-home').getAttribute('data-page'), '0');
  assert.equal(first.shadowRoot.querySelector('#home-host').getAttribute('data-mode'), 'idle');
  assert.equal(first.shadowRoot.querySelector('#stage-canvas').width, 120);
  assert.equal(preview.draws.length, 1);
  assert.equal(preview.stats.shadows, 1);
  preview.button('‹ 설정으로').dispatchEvent({ type: 'click' });
  assert.equal(phone.children.length, 0, 'closing customize discards the mounted preview');
  open.dispatchEvent({ type: 'click' });
  preview.flush();
  const second = phone.children.find((node) => node.className === 'magic-preview-surface');
  assert.notEqual(second, first);
  assert.equal(second.shadowRoot.querySelector('#fake-home').getAttribute('data-page'), 'notes');
  assert.equal(second.shadowRoot.querySelector('#home-host').getAttribute('data-mode'), 'live');
  assert.equal(second.shadowRoot.querySelector('#stage-canvas').width, 300);
  assert.equal(preview.draws.length, 2);
  assert.equal(preview.draws[1].width, 300);
  assert.equal(preview.draws[1].source, canvas);
  assert.equal(preview.stats.shadows, 2);
  ranges[0].dispatchEvent({ type: 'input' });
  preview.flush();
  assert.equal(preview.stats.shadows, 2, 'slider updates while customize stays open do not remount');
});

test('deleteEditRow updates #wz-num', async () => {
  const dom = choiceHarness();
  await bootChoice(dom);
  dom.get('new-list').dispatchEvent({ type: 'click' });
  dom.get('wz-title').value = '짧은 목록';
  dom.get('wz-next1').dispatchEvent({ type: 'click' });
  dom.get('wz-items').value = ['하나', '둘', '셋'].join('\n');
  dom.get('wz-next2').dispatchEvent({ type: 'click' });
  const picks = dom.get('wz-picks');
  picks.children[0].dispatchEvent({ type: 'click' });
  dom.get('wz-plus').dispatchEvent({ type: 'click' });
  dom.get('wz-plus').dispatchEvent({ type: 'click' });
  assert.equal(dom.get('wz-num').textContent, '3');
  dom.get('wz-edit-toggle').dispatchEvent({ type: 'click' });
  const edited = picks.replacements;
  picks.children[2].querySelector('[data-act="del"]').dispatchEvent({ type: 'click' });
  assert.equal(picks.replacements, edited, 'clamping the sample number does not rebuild the rows');
  assert.equal(picks.children.length, 2);
  assert.equal(dom.get('wz-num').textContent, '2');
  const hit = dom.get('wz-pv-lines').querySelector('.hit');
  assert.equal(hit.children[0].textContent, '2');
});

function loadRepair(options = {}) {
  const scope = 'http://127.0.0.1:18741/zz4/';
  const prefix = 'choice-shell-' + encodeURIComponent(scope) + '-';
  const foreign = 'choice-shell-' + encodeURIComponent('http://127.0.0.1:18741/zz5/') + '-v1';
  const names = [prefix + 'v20261010-choice-perf-1', prefix + 'old', foreign, 'notes-cache-v1'];
  const deleted = [];
  const fetches = [];
  const timers = [];
  const trace = [];
  const unregistered = [];
  const session = new Map(options.session || []);
  const listeners = new Map();
  const moduleListeners = [];
  let reloads = 0;
  let keyReads = 0;
  let registrationReads = 0;
  let storageReads = 0;
  let resolveProbe = () => {};
  const probe = options.probe || { fail: true };
  const ready = Object.prototype.hasOwnProperty.call(options, 'ready') ? options.ready : null;
  const moduleScript = {
    addEventListener(type, fn) { if (type === 'error') moduleListeners.push(fn); },
  };
  const document = {
    documentElement: { getAttribute(name) { return name === 'data-choice-ready' ? ready : null; } },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((fn) => fn(event));
      return true;
    },
    querySelector(selector) { return String(selector).includes('src="./app.js"') ? moduleScript : null; },
  };
  const sandbox = {
    Promise,
    URL: globalThis.URL,
    Date,
    encodeURIComponent: globalThis.encodeURIComponent,
    document,
    sessionStorage: {
      getItem(key) { return session.has(key) ? session.get(key) : null; },
      setItem(key, value) { session.set(key, String(value)); trace.push('guard'); },
      removeItem(key) { session.delete(key); },
    },
    location: { href: scope + 'index.html', reload() { reloads += 1; trace.push('reload'); } },
    navigator: {
      onLine: options.onLine,
      serviceWorker: {
        getRegistration() { registrationReads += 1; return Promise.resolve({ scope }); },
        getRegistrations() {
          return Promise.resolve([
            { scope, unregister() { unregistered.push(scope); trace.push('unregister'); return Promise.resolve(true); } },
            { scope: 'http://127.0.0.1:18741/zz5/', unregister() { unregistered.push('zz5'); trace.push('unregister'); return Promise.resolve(true); } },
          ]);
        },
      },
    },
    caches: {
      keys() { keyReads += 1; return Promise.resolve(names.slice()); },
      delete(name) { deleted.push(name); trace.push('delete'); return Promise.resolve(true); },
    },
    fetch(url, init) {
      fetches.push({ url: String(url), cache: init && init.cache });
      trace.push('fetch');
      if (probe.defer) return new Promise((resolve) => { resolveProbe = resolve; });
      if (probe.fail) return Promise.reject(new Error('probe failed'));
      return Promise.resolve({ ok: probe.ok === true });
    },
    setTimeout(fn, ms) { timers.push({ fn, ms: Number(ms) || 0 }); return timers.length; },
    clearTimeout() {},
  };
  Object.defineProperty(sandbox, 'localStorage', { get() { storageReads += 1; throw new Error('localStorage'); } });
  Object.defineProperty(sandbox, 'indexedDB', { get() { storageReads += 1; throw new Error('indexedDB'); } });
  sandbox.window = sandbox;
  const html = fs.readFileSync(new URL('../../zz4/index.html', import.meta.url), 'utf8');
  const match = html.match(/<script id="choice-repair">([\s\S]*?)<\/script>/);
  assert.ok(match, 'choice repair script');
  vm.runInNewContext(match[1], sandbox, { filename: 'zz4/index.html' });
  return {
    html, document, timers, moduleListeners, fetches, deleted, trace, unregistered, session, prefix, foreign, names, scope,
    get reloads() { return reloads; },
    get keyReads() { return keyReads; },
    get registrationReads() { return registrationReads; },
    get storageReads() { return storageReads; },
    resolveProbe(value) { resolveProbe(value); },
  };
}

test('the watchdog arms on a module error event and on the fallback timer', () => {
  const html = fs.readFileSync(new URL('../../zz4/index.html', import.meta.url), 'utf8');
  const moduleAt = html.indexOf('<script type="module" src="./app.js"></script>');
  const repairAt = html.indexOf('<script id="choice-repair">');
  assert.ok(moduleAt !== -1 && repairAt > moduleAt, 'the repair script can see the module element during parse');

  const errorCase = loadRepair();
  assert.equal(errorCase.timers.length, 0, 'the watchdog stays disarmed until the module starts, errors, or the fallback');
  assert.equal(errorCase.moduleListeners.length, 1);
  errorCase.moduleListeners[0]();
  assert.equal(errorCase.timers.length, 1);
  assert.equal(errorCase.timers[0].ms, 3000);
  errorCase.document.dispatchEvent({ type: 'DOMContentLoaded' });
  const fallback = errorCase.timers.find((timer) => timer.ms === 8000);
  assert.ok(fallback, 'DOMContentLoaded still starts the slow-network fallback');
  fallback.fn();
  assert.equal(errorCase.timers.filter((timer) => timer.ms === 3000).length, 1, 'an error that already armed the 3s window is not armed twice');

  const late = loadRepair();
  late.document.dispatchEvent({ type: 'DOMContentLoaded' });
  assert.equal(late.timers.map((timer) => timer.ms).join(','), '8000');
  late.timers[0].fn();
  assert.deepEqual(late.timers.map((timer) => timer.ms), [8000, 3000]);

  const started = loadRepair();
  started.document.dispatchEvent({ type: 'choice-module-start' });
  assert.equal(started.timers[0].ms, 3000);
  started.document.dispatchEvent({ type: 'DOMContentLoaded' });
  const eight = started.timers.find((timer) => timer.ms === 8000);
  const before = started.timers.length;
  eight.fn();
  assert.equal(started.timers.length, before, 'a module that already started keeps its own 3s window');
});

test('the watchdog does nothing offline or when the probe fails', async () => {
  const offline = loadRepair({ onLine: false, probe: { ok: true } });
  offline.document.dispatchEvent({ type: 'choice-module-start' });
  offline.timers[0].fn();
  await settleVm();
  assert.equal(offline.fetches.length, 0);
  assert.equal(offline.deleted.length, 0);
  assert.equal(offline.reloads, 0);
  assert.equal(offline.keyReads, 0);
  assert.equal(offline.storageReads, 0);

  const rejected = loadRepair({ onLine: true, probe: { fail: true } });
  rejected.document.dispatchEvent({ type: 'choice-module-start' });
  rejected.timers[0].fn();
  await settleVm();
  assert.equal(rejected.fetches.length, 1);
  assert.match(rejected.fetches[0].url, /^sw\.js\?probe=\d+$/);
  assert.equal(rejected.deleted.length, 0);
  assert.equal(rejected.reloads, 0);
  assert.equal(rejected.keyReads, 0);
  assert.equal(rejected.unregistered.length, 0);

  const notOk = loadRepair({ onLine: true, probe: { ok: false } });
  notOk.document.dispatchEvent({ type: 'choice-module-start' });
  notOk.timers[0].fn();
  await settleVm();
  assert.equal(notOk.fetches.length, 1);
  assert.equal(notOk.deleted.length, 0);
  assert.equal(notOk.reloads, 0);
  assert.equal(notOk.registrationReads, 0);
  assert.equal(notOk.session.has('choice-self-repair'), false);
});

test('the watchdog deletes caches only after the probe succeeds', async () => {
  const repair = loadRepair({ onLine: true, probe: { defer: true } });
  repair.document.dispatchEvent({ type: 'choice-module-start' });
  repair.timers[0].fn();
  await settleVm();
  assert.deepEqual(repair.trace, ['fetch']);
  assert.match(repair.fetches[0].url, /^sw\.js\?probe=\d+$/);
  assert.equal(repair.fetches[0].cache, 'no-store');
  assert.equal(repair.deleted.length, 0);
  assert.equal(repair.keyReads, 0);
  assert.equal(repair.registrationReads, 0);
  assert.equal(repair.reloads, 0);
  repair.resolveProbe({ ok: true });
  await settleVm();
  assert.deepEqual(repair.trace, ['fetch', 'guard', 'delete', 'delete', 'unregister', 'reload']);
  assert.deepEqual(repair.deleted, [repair.prefix + 'v20261010-choice-perf-1', repair.prefix + 'old']);
  assert.equal(repair.deleted.includes(repair.foreign), false);
  assert.equal(repair.deleted.includes('notes-cache-v1'), false);
  assert.deepEqual(repair.unregistered, [repair.scope]);
  assert.equal(repair.reloads, 1);
  assert.equal(repair.session.get('choice-self-repair'), '1');
  assert.equal(repair.storageReads, 0);

  const again = loadRepair({ onLine: true, probe: { ok: true }, session: [['choice-self-repair', '1']] });
  again.document.dispatchEvent({ type: 'choice-module-start' });
  again.timers[0].fn();
  await settleVm();
  assert.equal(again.fetches.length, 0);
  assert.equal(again.deleted.length, 0);
  assert.equal(again.reloads, 0);
});

test('a caught performance-start failure does not trigger the repair', async () => {
  const dom = choiceHarness();
  dom.get('fake-home').focus = () => { throw new Error('surface failed'); };
  await bootChoice(dom, {
    localStorage: {
      getItem(key) {
        if (key === 'magic-choice.v1.store') {
          return JSON.stringify({ version: 1, presets: [], options: { startMode: 'performance' } });
        }
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  });
  assert.match(dom.get('notes-entry-message').textContent, /공연 화면을 열지 못했습니다/);
  assert.match(dom.get('notes-entry-message').textContent, /surface failed/);
  assert.equal(dom.get('fake-home').hidden, true);
  assert.equal(dom.document.documentElement.getAttribute('data-choice-ready'), '1');

  const repair = loadRepair({ ready: '1', onLine: true, probe: { ok: true } });
  repair.document.dispatchEvent({ type: 'choice-module-start' });
  repair.timers[0].fn();
  await settleVm();
  assert.equal(repair.fetches.length, 0);
  assert.equal(repair.deleted.length, 0);
  assert.equal(repair.reloads, 0);
  assert.equal(repair.keyReads, 0);
});
