import {settings,reset} from './core.mjs';

export function setupSettings(ctx) {
const {$}=ctx;
function showDot(value){const label=`${value}%`;$('dotvalue').textContent=label;$('dot').setAttribute('aria-valuetext',label);}
function syncDot(){const value=String(ctx.state.config.dot);$('dot').value=value;showDot(value);}
function extraRow(ordinal='',target=''){const row=document.createElement('div');row.className='extrarow';const ordinalLabel=document.createElement('label');ordinalLabel.textContent='순서';const ordinalInput=document.createElement('input');ordinalInput.className='extra-ordinal';ordinalInput.type='number';ordinalInput.min='1';ordinalInput.max='1000000';ordinalInput.step='1';ordinalInput.value=ordinal===''||ordinal===undefined||ordinal===null?'':String(ordinal);ordinalInput.setAttribute('aria-label','순서');ordinalInput.autocomplete='off';ordinalLabel.appendChild(ordinalInput);const targetLabel=document.createElement('label');targetLabel.textContent='사이트';const targetInput=document.createElement('input');targetInput.className='extra-target';targetInput.type='url';targetInput.placeholder='https://';targetInput.value=target||'';targetInput.setAttribute('aria-label','사이트');targetInput.autocomplete='off';targetInput.spellcheck=false;targetLabel.appendChild(targetInput);const remove=document.createElement('button');remove.type='button';remove.className='extra-delete';remove.textContent='삭제';remove.onclick=()=>row.remove();row.appendChild(ordinalLabel);row.appendChild(targetLabel);row.appendChild(remove);return row;}
function renderExtras(list){const box=$('extras');while(box.firstChild)box.removeChild(box.firstChild);for(const item of list||[])box.appendChild(extraRow(item.ordinal,item.target));}
function readExtras(){return [...$('extras').querySelectorAll('.extrarow')].map(row=>({ordinal:row.querySelector('.extra-ordinal').value,target:row.querySelector('.extra-target').value}));}
function open(){if(ctx.dropPreview())ctx.render();ctx.renderInstall();$('target').value=ctx.state.config.target;$('ordinal').value=ctx.state.config.ordinal;renderExtras(ctx.state.config.extraTargets||[]);$('decoys').value=ctx.state.config.decoys.join('\n');syncDot();$('session').textContent=`현재 생성 횟수: ${ctx.state.counter}${ctx.state.frozen?' · 고정 중':''}`;$('error').textContent=ctx.storageNote;if(!$('settings').open)$('settings').showModal();ctx.syncPerformanceWakeLock();globalThis.MagicUpdate?.offer();}
$('close').onclick=()=>{$('settings').close();globalThis.MagicUpdate?.hide();ctx.syncPerformanceWakeLock();};
if (typeof $('settings').addEventListener === 'function') $('settings').addEventListener('close', () => { globalThis.MagicUpdate?.hide(); ctx.syncPerformanceWakeLock(); });
$('dot').oninput=()=>showDot($('dot').value);
$('add-extra').onclick=()=>$('extras').appendChild(extraRow());
$('form').onsubmit=e=>{e.preventDefault();try{const config=settings({target:$('target').value,ordinal:$('ordinal').value,decoys:$('decoys').value,dot:$('dot').value,extraTargets:readExtras()});const replaced=ctx.prepareExplicitWrite();if(replaced==='blocked')return;ctx.dropPreview();ctx.undoPointer=null;ctx.state.config=config;reset(ctx.state);const saved=ctx.persist(true);ctx.render();if(!saved){$('error').textContent=ctx.storageNote;return;}$('settings').close();ctx.syncPerformanceWakeLock();const note=ctx.replacementNote(replaced);if(note)ctx.notice(note);}catch(err){$('error').textContent=err.message;}};
function contactHref(nav) {
  var code = 'eshVqDvk7WKk0zDKtiC9UTa.T6Q-', ua = nav.userAgent || '';
  if (/Android/i.test(ua)) return 'intent://viewer?#Intent;scheme=kakaotalkqrcode%3A%2F%2F' + code + ';action=android.intent.action.SEND;category=android.intent.category.BROWSABLE;package=com.kakao.talk;end;';
  if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'kakaotalkqrcode://' + code;
  return 'https://qr.kakao.com/talk/' + code;
}
function copyContactId(button){
  const text='KaliDCerona';
  const finish=ok=>{button.textContent=ok?'복사됨':'ID 복사';if(ok)setTimeout(()=>{if(button.textContent==='복사됨')button.textContent='ID 복사';},1500);};
  const fallback=()=>{try{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-999px';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}};
  const clip=navigator.clipboard;
  if(clip&&typeof clip.writeText==='function'){clip.writeText(text).then(()=>finish(true),()=>finish(fallback()));return;}
  finish(fallback());
}
const contactLink=$('contact-open');if(contactLink)contactLink.href=contactHref(navigator);
$('contact-copy').onclick=()=>copyContactId($('contact-copy'));

Object.assign(ctx,{showDot,syncDot,extraRow,renderExtras,readExtras,open,contactHref,copyContactId});
}
