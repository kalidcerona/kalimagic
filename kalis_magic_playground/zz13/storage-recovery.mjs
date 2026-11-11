import {DEFAULTS,reset,restore,sessionConsistent,save} from './core.mjs';

export function setupStorageRecovery(ctx) {
const {$,key,preservedKey}=ctx;
const NOTE_UNREADABLE='저장된 내용을 읽지 못했습니다.\n원본을 읽고 보관할 수 있을 때까지 저장과 복원을 멈췄습니다.';
const NOTE_INVALID='저장된 내용을 확인하지 못했습니다.\n원본은 그대로 두었고 자동 저장은 멈췄습니다.\n설정 백업으로 그 원본을 받을 수 있습니다.\n저장하고 시작이나 백업 복원은 원본을 바꿉니다.';
const NOTE_KEPT_FILE='이전 저장 내용은 바꾸었습니다.\n읽을 수 있던 원본은 이 기기에 따로 남겨 두었고 백업 파일 다운로드도 요청했습니다.';
const NOTE_KEPT_DEVICE='이전 저장 내용은 바꾸었습니다.\n읽을 수 있던 원본은 이 기기에 따로 남겨 두었습니다.';
const NOTE_STASH_FAILED='원본을 따로 남기지 못해 저장소는 바꾸지 않았습니다.\n설정 백업으로 원본을 받은 뒤 다시 시도하세요.';
const NOTE_BACKUP_ORIGINAL='읽지 못한 저장 원본의 백업 다운로드를 요청했습니다.';
const NOTE_BACKUP_REFUSED='원본을 읽지 못해 기본 설정을 백업으로 내려받지 않습니다.';
function freshState(){return {config:{...DEFAULTS,decoys:[...DEFAULTS.decoys],extraTargets:[...(DEFAULTS.extraTargets||[])]},counter:0,frozen:false,current:null};}
Object.assign(ctx,{state:freshState(),storageIssue:false,writesHeld:false,preservedRaw:null,storageNote:'',retainedDownload:false});
// Missing data may become defaults. A failed read, parse, schema, or config keeps the exact raw value and blocks automatic writes.
function acceptLoaded(nextState){ctx.state=nextState;reset(ctx.state);}
function holdUnreadable(text){ctx.preservedRaw=text;ctx.writesHeld=true;ctx.storageIssue=true;ctx.storageNote=text==null?NOTE_UNREADABLE:NOTE_INVALID;acceptLoaded(freshState());}
function loadStored(){let raw;try{raw=localStorage.getItem(key);}catch{holdUnreadable(null);return;}if(raw==null){acceptLoaded(ctx.state);return;}const text=typeof raw==='string'?raw:String(raw);try{const restored=restore(text);if(sessionConsistent(restored)){ctx.state=restored;}else{acceptLoaded(restored);}return;}catch{}try{const saved=JSON.parse(text);acceptLoaded(restore(JSON.stringify({...saved,current:null})));return;}catch{}holdUnreadable(text);}
function readableRaw(){if(typeof ctx.preservedRaw==='string')return ctx.preservedRaw;try{const again=localStorage.getItem(key);if(typeof again==='string')return again;}catch{}return null;}
function stashRaw(raw){try{localStorage.setItem(preservedKey,raw);return localStorage.getItem(preservedKey)===raw;}catch{return false;}}
function prepareExplicitWrite(){if(!ctx.writesHeld)return 'ready';const raw=readableRaw();if(raw==null){ctx.storageNote=NOTE_UNREADABLE;$('error').textContent=ctx.storageNote;ctx.notice(ctx.storageNote);return 'blocked';}ctx.preservedRaw=raw;if(!stashRaw(raw)){ctx.storageNote=NOTE_STASH_FAILED;$('error').textContent=NOTE_STASH_FAILED;ctx.notice(NOTE_STASH_FAILED);return 'blocked';}ctx.retainedDownload=false;try{ctx.download(new Blob([raw],{type:'application/json'}),'QR-original.json');ctx.retainedDownload=true;}catch{}return 'kept';}
function replacementNote(kind){if(kind==='kept')return ctx.retainedDownload?NOTE_KEPT_FILE:NOTE_KEPT_DEVICE;return '';}
function persist(explicit=false){if(ctx.writesHeld&&!explicit)return false;let ok=false;try{ok=save(localStorage,key,ctx.state);}catch{}if(!ok){ctx.storageIssue=true;ctx.storageNote='이 기기에 저장할 수 없습니다.\n설정에서 백업하세요.';ctx.notice(ctx.storageNote);return false;}if(explicit){ctx.writesHeld=false;ctx.preservedRaw=null;}ctx.storageIssue=false;ctx.storageNote='';return true;}
// Ask once, after this page loads, for the browser to keep stored data. No prompt and no UI.
function askToKeepStoredData() {
  try {
    if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function") return;
    Promise.resolve(navigator.storage.persist()).catch(() => {});
  } catch {
    // A refusal is ignored. Nothing is shown.
  }
}

Object.assign(ctx,{NOTE_BACKUP_REFUSED,NOTE_BACKUP_ORIGINAL,freshState,acceptLoaded,holdUnreadable,loadStored,readableRaw,stashRaw,prepareExplicitWrite,replacementNote,persist,askToKeepStoredData});
}
