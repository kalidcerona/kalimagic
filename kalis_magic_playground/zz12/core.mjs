import {DECK, STACKS, RANKS, SUITS} from './data.mjs';
export function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length!==52 || new Set(cards).size!==52 || cards.some(c=>!DECK.includes(c))) throw new Error('카드 순서는 중복 없이 52장이어야 합니다. 예: AS, 10H, QC');
  return [...cards];
}
export function inverse(cards) {validateCards(cards);return Object.fromEntries(cards.map((c,i)=>[c,i+1]));}
export function range(start,end) {if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>52||start>end)throw new Error('범위는 1-52 사이의 시작·끝 번호를 입력하세요.');return Array.from({length:end-start+1},(_,i)=>start+i);}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function randomPosition(positions,current,random=Math.random){if(!positions.length)throw new Error('학습 범위가 비어 있습니다.');const other=positions.filter(p=>p!==current);return other.length?other[Math.floor(random()*other.length)]:positions[0];}
export function weakPositions(stats){return Object.entries(stats).filter(([,s])=>s.wrong>0||s.slow>0).map(([p])=>Number(p));}
export function newSession(stack,positions,mode,random=Math.random){if(!['position','card','mixed'].includes(mode))throw new Error('잘못된 퀴즈 방식');if(!positions.length)throw new Error('이 범위에 약점 카드가 없습니다.');return {stack,mode,queue:shuffle(positions,random).map(position=>({position,direction:mode==='mixed'?(random()<.5?'position':'card'):mode})),index:0,answered:false,results:[]};}
export function grade(cards,question,answer){return question.direction==='position'?answer===cards[question.position-1]:Number(answer)===question.position;}
export function record(progress,position,correct,ms,threshold=5000){const p=structuredClone(progress);const s=p.stats[position]??{attempts:0,correct:0,wrong:0,slow:0,totalMs:0};s.attempts++;s.correct+=Number(correct);s.wrong+=Number(!correct);s.slow+=Number(correct&&ms>threshold);s.totalMs+=ms;p.stats[position]=s;return p;}
export function freshState(){return {version:2,selected:'redford',stacks:Object.fromEntries(Object.entries(STACKS).map(([id,s])=>[id,[...s.cards]])),progress:{redford:freshProgress(),mnemonica:freshProgress()},session:null};}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function validateState(input){
  if(!input||![1,2].includes(input.version)||!['redford','mnemonica'].includes(input.selected))throw new Error('지원하지 않는 백업 형식입니다.');
  const out=freshState();out.selected=input.selected;
  for(const id of Object.keys(STACKS)){
    out.stacks[id]=validateCards(input.stacks?.[id]);const p=input.progress?.[id];
    if(!p||!p.stats||typeof p.stats!=='object'||Array.isArray(p.stats)||!Array.isArray(p.history)||p.history.length>1000)throw new Error('학습 기록 형식이 잘못되었습니다.');
    const stats={};for(const [key,s] of Object.entries(p.stats)){
      if(!/^(?:[1-9]|[1-4][0-9]|5[0-2])$/.test(key)||!s||!['attempts','correct','wrong','slow','totalMs'].every(k=>integer(s[k]))||s.correct+s.wrong!==s.attempts||s.slow>s.correct)throw new Error('카드 기록 값이 잘못되었습니다.');
      stats[key]=Object.fromEntries(['attempts','correct','wrong','slow','totalMs'].map(k=>[k,s[k]]));
    }
    const history=p.history.map(h=>{if(!h||!Number.isFinite(h.at)||h.at<0||!integer(h.total)||h.total<1||h.total>52||!integer(h.correct)||h.correct>h.total||!integer(h.ms)||!['position','card','mixed'].includes(h.mode))throw new Error('세션 기록 값이 잘못되었습니다.');return {at:h.at,total:h.total,correct:h.correct,ms:h.ms,mode:h.mode};});
    const extra=freshProgress();
    if(input.version===2){
      for(const [key,note] of Object.entries(p.notes??{})){if(!/^(?:[1-9]|[1-4][0-9]|5[0-2])$/.test(key)||typeof note!=='string'||note.length>2000)throw new Error('기억법 기록이 잘못되었습니다.');extra.notes[key]=note;}
      for(const [key,r] of Object.entries(p.review??{})){if(!/^(?:[1-9]|[1-4][0-9]|5[0-2])$/.test(key)||!r||!integer(r.step)||r.step>5||!integer(r.due))throw new Error('복습 일정이 잘못되었습니다.');extra.review[key]={step:r.step,due:r.due};}
      for(const [key,r] of Object.entries(p.rankStats??{})){if(!RANKS.includes(key)||!r||!integer(r.attempts)||!integer(r.correct)||!integer(r.totalMs)||r.correct>r.attempts)throw new Error('포카드 기록이 잘못되었습니다.');extra.rankStats[key]={attempts:r.attempts,correct:r.correct,totalMs:r.totalMs};}
      extra.rankHistory=(p.rankHistory??[]).map(h=>{if(!h||!integer(h.at)||!integer(h.total)||h.total<1||h.total>13||!integer(h.correct)||h.correct>h.total||!integer(h.ms))throw new Error('포카드 세션 기록이 잘못되었습니다.');return {at:h.at,total:h.total,correct:h.correct,ms:h.ms};}).slice(0,100);
    }
    out.progress[id]={...extra,stats,history};
  }
  // Imported backups deliberately omit live questions to avoid replaying stale attempts.
  return out;
}
export function validateSession(s){
  if(s?.mode==='rank')return validateRankSession(s);
  if(!s||!Object.hasOwn(STACKS,s.stack)||!['position','card','mixed'].includes(s.mode)||!Array.isArray(s.queue)||s.queue.length<1||s.queue.length>52||!integer(s.index)||s.index>=s.queue.length||typeof s.answered!=='boolean'||!Array.isArray(s.results))return null;
  if(new Set(s.queue.map(q=>q.position)).size!==s.queue.length||s.queue.some(q=>!Number.isInteger(q.position)||q.position<1||q.position>52||!['position','card'].includes(q.direction)))return null;
  if(s.results.length!==s.index+Number(s.answered)||s.results.some(r=>!r||typeof r.correct!=='boolean'||!integer(r.ms)))return null;
  return structuredClone(s);
}
export function loadState(text){const parsed=JSON.parse(text);const state=validateState(parsed);state.session=validateSession(parsed.session);return state;}
export function totals(stats){return Object.values(stats).reduce((a,s)=>({attempts:a.attempts+s.attempts,correct:a.correct+s.correct,ms:a.ms+s.totalMs}),{attempts:0,correct:0,ms:0});}

export function freshProgress(){return {stats:{},history:[],notes:{},review:{},rankStats:{},rankHistory:[]};}
export const REVIEW_DAYS=[1,3,7,14,30];
export function scheduleReview(progress,position,correct,now=Date.now()){
  const p=structuredClone(progress),old=p.review[position];
  if(correct&&old&&now<old.due)return p;
  const timely=old&&now>=old.due;
  const step=correct?(timely?Math.min(old.step+1,5):(old?.step??1)):0;
  p.review[position]={step,due:now+REVIEW_DAYS[Math.max(0,step-1)]*86400000};return p;
}
export function duePositions(progress,now=Date.now()){return Object.entries(progress.review).filter(([,r])=>r.due<=now).map(([p])=>Number(p));}
export function rankPositions(cards,rank){if(!RANKS.includes(rank))throw new Error('잘못된 숫자·그림입니다.');const map=inverse(cards);return Object.fromEntries(Object.keys(SUITS).map(s=>[s,map[rank+s]]));}
export function gradeRank(cards,rank,answers){
  const values=Object.keys(SUITS).map(s=>answers?.[s]);
  if(values.some(v=>!['number','string'].includes(typeof v)||typeof v==='string'&&!/^[0-9]+$/.test(v)||v===null||v===undefined||!Number.isInteger(Number(v))||Number(v)<1||Number(v)>52)||new Set(values.map(Number)).size!==4)throw new Error('각 무늬에 서로 다른 1-52 정수 번호 네 개를 입력하세요.');
  const expected=rankPositions(cards,rank),suits=Object.fromEntries(Object.keys(SUITS).map(s=>[s,Number(answers[s])===expected[s]]));return {correct:Object.values(suits).every(Boolean),suits,expected};
}
export function newRankSession(stack,rank=null,random=Math.random){return {stack,mode:'rank',queue:rank?[rank]:shuffle(RANKS,random),index:0,answered:false,results:[]};}
function validateRankSession(s){
  if(!Object.hasOwn(STACKS,s.stack)||!Array.isArray(s.queue)||!s.queue.length||s.queue.length>13||new Set(s.queue).size!==s.queue.length||s.queue.some(r=>!RANKS.includes(r))||!integer(s.index)||s.index>=s.queue.length||typeof s.answered!=='boolean'||!Array.isArray(s.results)||s.results.length!==s.index+Number(s.answered))return null;
  if(s.results.some(r=>!r||typeof r.correct!=='boolean'||!integer(r.ms)||Object.keys(SUITS).some(k=>typeof r.suits?.[k]!=='boolean')))return null;return structuredClone(s);
}
export function answerRank(state,answers,ms){const next=structuredClone(state),s=next.session;if(!s||s.mode!=='rank'||s.answered)return next;const rank=s.queue[s.index],result=gradeRank(next.stacks[s.stack],rank,answers);const p=next.progress[s.stack],r=p.rankStats[rank]??{attempts:0,correct:0,totalMs:0};r.attempts++;r.correct+=Number(result.correct);r.totalMs+=ms;p.rankStats[rank]=r;s.results.push({...result,ms});s.answered=true;return next;}
export function replaceStack(state,id,cards){const next=structuredClone(state);next.stacks[id]=validateCards(cards);next.progress[id]=freshProgress();next.session=null;return next;}
export function escapeHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
