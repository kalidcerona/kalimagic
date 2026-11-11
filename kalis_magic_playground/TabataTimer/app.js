(() => {
  const D = window.TabataData;
  const memory = new Map();
  const storage = {
    getItem(k) { if(memory.has(k)) return memory.get(k);try { return localStorage.getItem(k); } catch { return null; } },
    setItem(k,v) { memory.set(k,v);try { localStorage.setItem(k,v);return true; } catch { return false; } }
  };
  const store = {
    get(k,d) { try { return JSON.parse(storage.getItem(k)) ?? d; } catch { return d; } },
    set(k,v) { try { return storage.setItem(k,JSON.stringify(v)); } catch { return false; } }
  };
  let opts = Object.assign({beep:true,voice:true,vibe:true},store.get('tt.opts',{}));
  const $ = id => document.getElementById(id);
  const sound = TabataAudio(opts);
  const wake = TabataWakeLock(() => run.tick());
  const editor = TabataEditor({ D, storage, store, $, openReady: timer => run.openReady(timer) });
  const run = TabataRun({ D, $, sound, keepAwake: wake.keepAwake, renderHome: editor.renderHome });
  [['optBeep','beep'],['optVoice','voice'],['optVibe','vibe']].forEach(([id,key])=>{const el=$(id);el.checked=!!opts[key];el.addEventListener('change',()=>{opts[key]=el.checked;store.set('tt.opts',opts);});});
  // Ask once, after this page loads, for the browser to keep stored data. No prompt and no UI.
  function askToKeepStoredData() {
    try {
      if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return;
      Promise.resolve(navigator.storage.persist()).catch(() => {});
    } catch {
      // A refusal is ignored. Nothing is shown.
    }
  }
  askToKeepStoredData();

  $('openInfo').addEventListener('click', () => { $('settings').showModal(); globalThis.MagicUpdate?.offer(); }); // the info dialog is off-stage
  $('closeInfo').addEventListener('click', () => $('settings').close());
  $('settings').addEventListener('close', () => globalThis.MagicUpdate?.hide());
  function copyContactId(button){
  const text='KaliDCerona';
  const finish=ok=>{button.textContent=ok?'복사됨':'ID 복사';if(ok)setTimeout(()=>{if(button.textContent==='복사됨')button.textContent='ID 복사';},1500);};
  const fallback=()=>{try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-999px';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}};
  const clip=navigator.clipboard;
  if(clip&&typeof clip.writeText==='function'){clip.writeText(text).then(()=>finish(true),()=>finish(fallback()));return;}
  finish(fallback());
}

  $('contact-copy').addEventListener('click', () => copyContactId($('contact-copy')));
  if ('serviceWorker' in navigator) {
    const registration = navigator.serviceWorker.register('./sw.js');
    registration.catch(() => {});
    globalThis.MagicUpdate?.init({ registrationPromise: registration, safe: () => $('settings').open === true && $('run').hidden && !run.isRunning() });
  }

  editor.renderHome();
  wake.keepAwake();
})();
