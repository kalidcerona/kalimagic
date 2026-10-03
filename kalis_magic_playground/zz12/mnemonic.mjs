// Pure, deterministic helpers for text-based memorized-deck training.
export const LIMITS = {image:120, scene:2000, locus:80, title:80, story:1000, stories:12, loci:52, group:8};

export const NUMBER_PEGS = [null,
  '촛불','백조','삼지창','돛단배','갈고리','체리','도끼','눈사람','풍선','볼링핀',
  '젓가락','시계','고양이','번개','손바닥','주사위','열쇠','안경','깃발','집',
  '나비','쌍둥이','하프','달력','은화','나침반','망치','모래시계','우산','왕관',
  '화살','돛배','벌집','별','고리','장미','사다리','달','풍차','지도',
  '편지','종','거울','방패','닻','용','등대','책','사과','금화','기차','성문'];

const RANK_IMAGE = {A:'에이스',2:'두 점',3:'세 점',4:'네 점',5:'다섯 점',6:'여섯 점',7:'일곱 점',8:'여덟 점',9:'아홉 점',10:'열 점',J:'전령',Q:'왕비',K:'왕'};
const SUIT_IMAGE = {S:'검은 삽',H:'붉은 심장',D:'붉은 보석',C:'토끼풀'};

export const STARTER_PALACE = {
  title:'우리 집',
  loci:[
    {name:'현관문', position:1},
    {name:'신발장', position:2},
    {name:'거실 소파', position:3},
    {name:'식탁', position:4},
    {name:'주방 싱크', position:5},
  ],
};

export function freshMnemonics(){return {images:{}, palace:null, stories:[]};}

export function starterNumberImage(position){
  if(!Number.isInteger(position)||position<1||position>52) throw new Error('잘못된 위치입니다.');
  return NUMBER_PEGS[position];
}
export function starterCardImage(card){
  const rank=String(card).slice(0,-1), suit=String(card).slice(-1);
  if(!RANK_IMAGE[rank]||!SUIT_IMAGE[suit]) throw new Error('잘못된 카드입니다.');
  return `${RANK_IMAGE[rank]} ${SUIT_IMAGE[suit]}`;
}
export function starterScene(position, card){
  return `${starterNumberImage(position)} 옆에 ${starterCardImage(card)}가 있다.`;
}
export function starterStory(cards, start, end){
  const positions=groupPositions(start, end);
  return positions.map(position=>`${starterNumberImage(position)}가 ${starterCardImage(cards[position-1])}를 만난다`).join('. ')+'.';
}

export function sameText(a, b){
  const norm=value=>String(value).trim().replace(/\s+/g,' ');
  return norm(a)===norm(b);
}

function copyPositions(positions){
  if(!Array.isArray(positions)||!positions.length||positions.some(position=>!Number.isInteger(position)||position<1||position>52)) throw new Error('학습 범위가 비어 있습니다.');
  return [...positions];
}
function blankItem(position, direction, stage, locus=''){
  return {position, direction, stage, retried:false, locus};
}
function directionOf(random){return random()<0.5?'position':'card';}

export function buildPairQueue(positions, random=Math.random){
  return shuffleLocal(copyPositions(positions), random).map(position=>blankItem(position, directionOf(random), 'pair'));
}
export function buildDirectQueue(positions, random=Math.random){
  return shuffleLocal(copyPositions(positions), random).map(position=>blankItem(position, directionOf(random), 'direct'));
}
export function buildImageQueue(positions, random=Math.random){
  return shuffleLocal(copyPositions(positions), random).flatMap(position=>[
    blankItem(position, 'position', 'scene'),
    blankItem(position, directionOf(random), 'cue'),
    blankItem(position, directionOf(random), 'direct'),
  ]);
}
export function buildPalaceQueue(loci, random=Math.random){
  if(!Array.isArray(loci)||!loci.length) throw new Error('장소가 없습니다.');
  const kinds=['position','card','locus'];
  return shuffleLocal(loci.map(locus=>({name:locus.name, position:locus.position})), random).map(locus=>blankItem(locus.position, kinds[Math.floor(random()*kinds.length)], 'direct', locus.name));
}
function shuffleLocal(items, random){
  const a=[...items];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

export function schedulesRecall(stage){return stage==='direct'||stage==='pair';}

// Scene and cue passes are assisted. A pair counts as direct only after one side is hidden.
export function classifyRecall({stage, concealed, usedHint, revealed, correct}){
  if(revealed) return 'revealed';
  const assisted=Boolean(usedHint)||stage==='scene'||stage==='cue'||(stage==='pair'&&!concealed);
  if(assisted) return 'hinted';
  return correct?'direct-correct':'direct-wrong';
}

// One extra direct attempt. Learning passes already continue to the direct stage.
export function enqueueRetry(queue, index, outcome){
  const item=queue[index];
  if(!item||outcome==='direct-correct'||!schedulesRecall(item.stage)||item.retried) return queue;
  return [...queue, {...item, retried:true, stage:'direct'}];
}

export function groupPositions(start, end){
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>52||start>end) throw new Error('범위는 1-52 사이의 시작·끝 번호를 입력하세요.');
  if(end-start+1>LIMITS.group) throw new Error('이야기는 한 번에 8장까지입니다.');
  return Array.from({length:end-start+1},(_,i)=>start+i);
}

const POSITION=/^(?:[1-9]|[1-4][0-9]|5[0-2])$/;
export function validateMnemonics(input){
  if(input==null) return freshMnemonics();
  if(typeof input!=='object'||Array.isArray(input)) throw new Error('기억 훈련 형식이 잘못되었습니다.');
  const images={};
  const rawImages=input.images??{};
  if(typeof rawImages!=='object'||Array.isArray(rawImages)) throw new Error('숫자 이미지 형식이 잘못되었습니다.');
  for(const [key,value] of Object.entries(rawImages)){
    if(!POSITION.test(key)||!value||typeof value!=='object'||Array.isArray(value)) throw new Error('숫자 이미지 형식이 잘못되었습니다.');
    const numberImage=value.numberImage??'';
    const cardImage=value.cardImage??'';
    const scene=value.scene??'';
    if(typeof numberImage!=='string'||typeof cardImage!=='string'||typeof scene!=='string') throw new Error('숫자 이미지 형식이 잘못되었습니다.');
    if(numberImage.length>LIMITS.image||cardImage.length>LIMITS.image||scene.length>LIMITS.scene) throw new Error('숫자 이미지 길이가 너무 깁니다.');
    if(!numberImage&&!cardImage&&!scene) continue;
    images[key]={numberImage, cardImage, scene};
  }
  let palace=null;
  if(input.palace!=null){
    const source=input.palace;
    if(typeof source!=='object'||Array.isArray(source)||typeof source.title!=='string'||source.title.length>LIMITS.title||!Array.isArray(source.loci)||source.loci.length>LIMITS.loci) throw new Error('기억 궁전 형식이 잘못되었습니다.');
    const loci=[];
    const seen=new Set();
    for(const locus of source.loci){
      if(!locus||typeof locus.name!=='string'||!locus.name.trim()||locus.name.length>LIMITS.locus||!Number.isInteger(locus.position)||locus.position<1||locus.position>52||seen.has(locus.position)) throw new Error('기억 궁전 장소가 잘못되었습니다.');
      seen.add(locus.position);
      loci.push({name:locus.name.trim(), position:locus.position});
    }
    palace={title:source.title.trim(), loci};
  }
  if(input.stories!=null&&!Array.isArray(input.stories)) throw new Error('이야기 형식이 잘못되었습니다.');
  const stories=[];
  for(const story of input.stories??[]){
    if(!story||!Number.isInteger(story.start)||!Number.isInteger(story.end)||story.start<1||story.end>52||story.start>story.end||story.end-story.start+1>LIMITS.group||typeof story.text!=='string'||story.text.length>LIMITS.story) throw new Error('이야기 형식이 잘못되었습니다.');
    stories.push({start:story.start, end:story.end, text:story.text});
  }
  if(stories.length>LIMITS.stories) throw new Error('이야기가 너무 많습니다.');
  return {images, palace, stories};
}
