import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../zz11/settings-ui.js', import.meta.url), 'utf8');
function runtime(options = {}) {
  const store = new Map([['performance-state', '{"counter":3,"revealed":true}']]);
  const nodes = [];
  let unreadable = Boolean(options.unreadable), resetFails = Boolean(options.resetFails);
  const storage = {
    getItem(key) { if (unreadable) throw Error('read denied'); return store.get(key) ?? null; },
    setItem(key, value) { store.set(key, value); },
    removeItem(key) { if (resetFails) throw Error('remove denied'); store.delete(key); },
  };
  function node(tag) {
    const listeners = new Map();
    const el = {tagName:tag.toUpperCase(),dataset:{},children:[],style:{removeProperty(){}},attributes:{},hidden:false,textContent:'',value:'',classList:{add(){},remove(){},toggle(){}},
      appendChild(child){ child.parentElement=el;el.children.push(child);return child; },
      setAttribute(name,value){el.attributes[name]=value;},getAttribute(name){return el.attributes[name]??null;},
      addEventListener(type,fn){listeners.set(type,fn);},dispatchEvent(event){listeners.get(event.type)?.(event);},
      querySelector(){return null;},querySelectorAll(){return [];},focus(){},
    };
    nodes.push(el); return el;
  }
  const body=node('body'); body.dataset.magicApp=options.app||'spinner';
  const container=node('section');body.appendChild(container);
  const document={body,readyState:'complete',activeElement:null,querySelector(selector){return selector.startsWith('[data-settings-root]')||selector==='#settings'?container:null;},querySelectorAll(){return [];},createElement:node,addEventListener(){},dispatchEvent(){}};
  const context={localStorage:storage,location:{origin:'https://example.test',pathname:'/zz11/',hash:'',search:''},requestAnimationFrame(){},addEventListener(){},Event:class {constructor(type){this.type=type;}}};
  vm.createContext(context);
  // Load the complete real script without mounting so its public key/API can seed storage.
  vm.runInContext(source,context);
  const key=context.MagicSettingsUI.storageKey(body.dataset.magicApp,context.location);
  if (options.raw !== undefined) store.set(key,options.raw);
  if (options.mount) { context.document=document;vm.runInContext(source,context); }
  return {ui:context.MagicSettingsUI,storage,store,key,nodes,setUnreadable(value){unreadable=value;},setResetFails(value){resetFails=value;},click(text){const button=nodes.find(el=>el.tagName==='BUTTON'&&el.textContent===text);assert.ok(button,text);button.dispatchEvent({type:'click'});},status(){return nodes.find(el=>el.attributes.role==='status')?.textContent;}};
}

test('invalid and unreadable appearance data survive actual exported read/write', () => {
  for (const options of [{raw:'{original'}, {raw:'null'}, {raw:'[]'}, {raw:'{"offset":3}',unreadable:true}]) {
    const r=runtime(options),before=r.store.get(r.key),p=r.ui.profiles.spinner;
    assert.equal(r.ui.write(r.storage,r.key,r.ui.read(r.storage,r.key,p),p),false);
    assert.equal(r.store.get(r.key),before);
  }
});

test('missing, valid zero offsets, empty allowed labels and existing sanitizer defaults remain compatible', () => {
  const r=runtime(),profile=r.ui.profiles.stopwatch;
  assert.equal(r.ui.load(r.storage,r.key,profile).status,'missing');
  const selector=profile.labels[0].selector;
  const value={scale:100,offset:0,x:0,labels:{[selector]:''},parts:{},unusedFlag:false};
  assert.equal(r.ui.write(r.storage,r.key,value,profile),true);
  const loaded=r.ui.load(r.storage,r.key,profile);
  assert.equal(loaded.status,'valid');
  assert.equal(loaded.value.offset,0);assert.equal(loaded.value.x,0);assert.equal(loaded.value.labels[selector],'');
  assert.equal(Object.hasOwn(loaded.value,'unusedFlag'),false);
  assert.equal(JSON.stringify(r.ui.read(r.storage,r.key,profile)),JSON.stringify(loaded.value));
});

test('actual editor normal apply preserves failed-load original, then explicit reset permits saving', () => {
  for (const options of [{raw:'{user-original'}, {raw:'{"scale":115}',unreadable:true}]) {
    const r=runtime({...options,mount:true}),before=r.store.get(r.key),performance=r.store.get('performance-state');
    assert.match(r.status(),/원본/);
    r.setUnreadable(false);
    r.click('저장');
    assert.equal(r.store.get(r.key),before);
    assert.match(r.status(),/꾸미기 초기화/);
    r.click('꾸미기 초기화');
    assert.equal(r.store.has(r.key),false);
    r.click('저장');
    assert.equal(JSON.parse(r.store.get(r.key)).scale,100);
    assert.equal(r.store.get('performance-state'),performance);
  }
});

test('failed explicit reset keeps original and editor write lock', () => {
  const r=runtime({raw:'{original',mount:true,resetFails:true});
  r.click('꾸미기 초기화');r.click('저장');
  assert.equal(r.store.get(r.key),'{original');assert.match(r.status(),/원본/);
});

test('TOBIRA offers design-only recovery reset only when common appearance loading failed', () => {
  const failed=runtime({app:'tobira',raw:'{original',mount:true});
  assert.equal(failed.nodes.find(el=>el.textContent==='꾸미기 초기화').hidden,false);
  const normal=runtime({app:'tobira',mount:true});
  assert.equal(normal.nodes.find(el=>el.textContent==='꾸미기 초기화').hidden,true);
});
