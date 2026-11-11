globalThis.TabataEditor = function ({ D, storage, store, $, openReady }) {
  const { fmt, displayTime, build, totalOf, button } = TabataView;
  let timers = D.load(storage), draft = null, picker = null;
  const FIELDS = [
    {key:'prep',name:'준비',hint:'시작 전 카운트다운',time:true},
    {key:'work',name:'운동',hint:'한 라운드의 운동 시간',time:true},
    {key:'rest',name:'휴식',hint:'라운드 사이 쉬는 시간',time:true},
    {key:'rounds',name:'라운드',hint:'1라운드는 운동 + 휴식',time:false},
    {key:'cycles',name:'사이클',hint:'전체 라운드 반복 횟수',time:false},
    {key:'setrest',name:'사이클 사이 휴식',hint:'사이클이 끝날 때마다',time:true},
    {key:'cool',name:'쿨다운',hint:'마무리 스트레칭',time:true}
  ];
  function persist(next) {
    timers=next;
    $('storageNote').textContent=store.set('tt.timers.v2',timers)?'':'저장 공간을 사용할 수 없어요. 이 화면을 닫으면 변경 사항이 사라질 수 있어요.';
    renderHome();
  }
  let menuReturn = null;
  function renderHome() {
    $('timers').replaceChildren(...timers.map(timer=>{
      const card=document.createElement('article');card.className='timer-card';card.style.setProperty('--timer-color',timer.colors.work);
      const launch=button('',()=>openReady(timer),'timer-launch');
      const duration=document.createElement('span');duration.className='timer-duration num';duration.textContent=fmt(totalOf(build(timer.v,timer.skipLast))).padStart(5,'0');
      const name=document.createElement('strong');name.textContent=timer.name;launch.append(duration,name);
      const menu=button('⋯',()=>openMenu(timer,menu),'timer-menu');menu.setAttribute('aria-label',timer.name+' 메뉴'); menu.setAttribute('aria-haspopup','dialog');
      card.append(launch,menu);return card;
    }));
    $('empty').hidden=timers.length>0;
  }
  function openMenu(timer,origin) {
    menuReturn=origin; $('menuTitle').textContent=timer.name;
    const actions=$('menuActions');actions.replaceChildren(
      button('편집',()=>{$('timerMenu').close();openEditor(timer);}),
      button('복제',()=>{persist(D.duplicate(timers,timer.id));$('timerMenu').close();}),
      button('삭제',()=>{
        $('menuTitle').textContent='이 타이머를 삭제할까요?';
        actions.replaceChildren(button('취소',()=>$('timerMenu').close()),button('삭제',()=>{persist(D.remove(timers,timer.id));$('timerMenu').close();},'btn2 danger'));
      },'btn2 danger')
    );$('timerMenu').showModal();
  }
  $('timerMenu').addEventListener('close',()=>{if(menuReturn?.isConnected) menuReturn.focus();else $('newTimer').focus();});
  $('closeMenu').addEventListener('click',()=>$('timerMenu').close());
  function openEditor(timer) {
    draft=D.timer(timer);$('timerName').value=draft.name;$('optSkipLast').checked=draft.skipLast;
    $('setup').hidden=true;$('editor').hidden=false;renderRows();$('timerName').focus();
  }
  function closeEditor() { $('editor').hidden=true;$('setup').hidden=false;draft=null;$('newTimer').focus(); }
  $('cancelEditor').addEventListener('click',closeEditor);
  $('saveTimer').addEventListener('click',()=>{
    if(!$('timerName').value.trim()) {$('timerName').focus();return;}
    draft.name=$('timerName').value.trim();draft.skipLast=$('optSkipLast').checked;
    persist(D.save(timers,draft));closeEditor();
  });
  $('newTimer').addEventListener('click',()=>{
    $('templateChoices').replaceChildren(button('새 타이머',()=>{$('newSheet').close();openEditor();}),...D.BUILTIN.map(p=>button(p.name,()=>{$('newSheet').close();openEditor(p);})));
    $('newSheet').showModal();
  });
  $('closeNew').addEventListener('click',()=>$('newSheet').close());
  function renderRows() {
    $('rows').replaceChildren(...FIELDS.filter(f=>f.key!=='setrest'||draft.optional.cycles).map(f=>{
      const optional=f.key==='cycles'||f.key==='cool';
      const absent=optional&&!draft.optional[f.key];
      const row=button('',()=>{if(absent){draft=D.optional(draft,f.key,true);renderRows();}else openPicker(f);},'edit-row'+(absent?' optional-row':''));
      const phase=draft.colors[f.key]||draft.colors[f.key==='rounds'?'work':'setrest'];
      row.style.setProperty('--row-color',phase);
      const title=document.createElement('span');title.className='row-label';
      const name=document.createElement('strong');name.textContent=f.name;
      const hint=document.createElement('small');hint.textContent=f.hint;title.append(name,hint);
      const value=document.createElement('span');value.className='row-value num';value.textContent=absent?'+':f.time?displayTime(draft.v[f.key]):draft.v[f.key];
      const chevron=document.createElement('span');chevron.className='chevron';chevron.textContent=absent?'':'›';
      row.append(title,value,chevron);return row;
    }));
    $('editorTotal').textContent='총 '+fmt(totalOf(build(draft.v,$('optSkipLast').checked)));
  }
  $('optSkipLast').addEventListener('change',renderRows);
  function openPicker(field) {
    picker={field,value:D.clamp(field.key,draft.v[field.key]),color:draft.colors[field.key]};
    $('pickerTitle').textContent=field.name;$('editor').hidden=true;$('picker').hidden=false;
    const removeKey=['cycles','setrest'].includes(field.key)?'cycles':field.key==='cool'?'cool':null;
    $('removePhase').hidden=!removeKey;$('removePhase').textContent=(removeKey==='cycles'?'사이클':field.name)+' 삭제';
    $('phaseColors').hidden=!field.time;
    $('phaseColors').replaceChildren(...D.COLORS.map((color,i)=>{
      const dot=button('',()=>{picker.color=color;refreshDots();},'color-dot');dot.style.background=color;dot.dataset.color=color;dot.setAttribute('aria-label',['빨강','주황','호박','초록','파랑','보라'][i]);return dot;
    }));refreshDots();
    const wheels=$('wheels');wheels.replaceChildren();
    if(field.time) {
      let minutes,seconds;
      const update=value=>{picker.value=D.clamp(field.key,value);if(picker.value!==value){minutes?.(Math.floor(picker.value/60));seconds?.(picker.value%60);}};
      minutes=makeWheel('MIN',0,Math.floor(D.clamp(field.key,Number.MAX_SAFE_INTEGER)/60),Math.floor(picker.value/60),v=>update(v*60+picker.value%60));
      seconds=makeWheel('SEC',0,59,picker.value%60,v=>update(Math.floor(picker.value/60)*60+v));
    }
    else makeWheel(field.name,1,field.key==='cycles'?20:99,picker.value,v=>{picker.value=v;});
    $('cancelPicker').focus();
  }
  function refreshDots() { for(const dot of $('phaseColors').children) dot.setAttribute('aria-pressed',String(dot.dataset.color===picker.color)); }
  function makeWheel(label,min,max,initial,onChange) {
    const wrap=document.createElement('div');wrap.className='wheel-column';
    const caption=document.createElement('span');caption.textContent=label;caption.className='wheel-caption';
    const wheel=document.createElement('div');wheel.className='wheel';wheel.tabIndex=0;wheel.setAttribute('role','spinbutton');wheel.setAttribute('aria-label',label);wheel.setAttribute('aria-valuemin',min);wheel.setAttribute('aria-valuemax',max);
    let selected=initial;
    const select=value=>{selected=Math.min(max,Math.max(min,value));wheel.setAttribute('aria-valuenow',selected);onChange(selected);for(const option of wheel.children) option.classList.toggle('selected',Number(option.dataset.value)===selected);};
    const go=value=>{select(value);wheel.scrollTo({top:(selected-min)*64,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};
    for(let value=min;value<=max;value++) {const option=button(String(value).padStart(2,'0'),()=>go(value),'wheel-number');option.tabIndex=-1;option.dataset.value=value;wheel.append(option);}
    wheel.addEventListener('scroll',()=>select(min+Math.round(wheel.scrollTop/64)),{passive:true});
    wheel.addEventListener('keydown',e=>{
      const next={ArrowUp:selected-1,ArrowDown:selected+1,ArrowLeft:selected-1,ArrowRight:selected+1,Home:min,End:max,PageUp:selected-5,PageDown:selected+5}[e.key];
      if(next!==undefined){e.preventDefault();go(next);}
    });
    wrap.append(caption,wheel);$('wheels').append(wrap);select(initial);wheel.scrollTop=(initial-min)*64;
    return value=>{selected=value;wheel.setAttribute('aria-valuenow',selected);for(const option of wheel.children) option.classList.toggle('selected',Number(option.dataset.value)===selected);if(wheel.scrollTop!==(selected-min)*64)wheel.scrollTop=(selected-min)*64;};
  }
  function closePicker() {$('picker').hidden=true;$('editor').hidden=false;picker=null;renderRows();$('rows').querySelector('button')?.focus();}
  $('cancelPicker').addEventListener('click',closePicker);
  $('savePicker').addEventListener('click',()=>{draft.v[picker.field.key]=D.clamp(picker.field.key,picker.value);if(picker.color)draft.colors[picker.field.key]=picker.color;closePicker();});
  $('removePhase').addEventListener('click',()=>{draft=D.optional(draft,['cycles','setrest'].includes(picker.field.key)?'cycles':'cool',false);closePicker();});
  return { renderHome };
};
