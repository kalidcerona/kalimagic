import { validateState, range } from './core.mjs';
import { STARTER_PALACE, starterNumberImage, starterCardImage, starterScene, starterStory, groupPositions } from './mnemonic.mjs';

// Each app boot owns its context; modules do not retain browser or practice state.
export function createMemoryModel(ctx) {
  function commitMemory(candidate) {
    let clean;
    try {
      clean = validateState(candidate);
      clean.session = candidate.session ?? null;
    } catch (error) {
      ctx.message(error.message);
      return false;
    }
    if (ctx.writeBlocked) {
      ctx.state = clean;
      return true;
    }
    if (!ctx.persist(clean))
      return false;
    ctx.state = clean;
    return true;
  }

  function pack() {
    return ctx.progress().mnemonics || {
      images: {},
      palace: null,
      stories: []
    };
  }

  function imageFields(position) {
    if (ctx.imageDrafts.has(position))
      return ctx.imageDrafts.get(position);
    const image = pack().images[String(position)] || {};
    return {
      numberImage: image.numberImage || '',
      cardImage: image.cardImage || '',
      scene: image.scene || ctx.progress().notes[position] || ''
    };
  }

  function sceneText(position) {
    const image = pack().images[String(position)] || {};
    return image.scene || ctx.progress().notes[position] || starterScene(position, ctx.cards()[position - 1]);
  }

  function numberImageFor(position) {
    const image = pack().images[String(position)] || {};
    return image.numberImage || starterNumberImage(position);
  }

  function cardImageFor(position) {
    const image = pack().images[String(position)] || {};
    return image.cardImage || starterCardImage(ctx.cards()[position - 1]);
  }

  function savedNote(text) {
    ctx.message(ctx.writeBlocked ? '이 화면에만 반영했습니다. 원본 기록은 바꾸지 않았습니다.' : text);
  }

  function memoryRangeValues() {
    const a = Number(document.querySelector('#mem-start').value), b = Number(document.querySelector('#mem-end').value);
    range(a, b);
    return [
      a,
      b
    ];
  }

  function memRangeHTML() {
    return `<div class="controls range"><label>시작<input id="mem-start" type="number" min="1" max="52" value="${ ctx.memoryStart }"></label><label>끝<input id="mem-end" type="number" min="1" max="52" value="${ ctx.memoryEnd }"></label><button type="button" id="mem-apply">적용</button></div>`;
  }

  function stageName(stage) {
    return {
      scene: '장면',
      cue: '단서',
      direct: '직접',
      pair: '짝'
    }[stage] || '연습';
  }

  function storyTextFor(start, end) {
    if (ctx.storyDraft && ctx.storyDraft.start === start && ctx.storyDraft.end === end)
      return ctx.storyDraft.text;
    const saved = pack().stories.find(story => story.start === start && story.end === end);
    if (saved)
      return saved.text;
    return starterStory(ctx.cards(), start, end);
  }

  function palaceModel() {
    if (ctx.palaceDraft)
      return ctx.palaceDraft;
    const saved = pack().palace;
    if (saved)
      return {
        title: saved.title,
        loci: saved.loci.map(locus => ({ ...locus })),
        example: false
      };
    return {
      title: STARTER_PALACE.title,
      loci: STARTER_PALACE.loci.map(locus => ({ ...locus })),
      example: true
    };
  }

  function readPalaceRaw() {
    const names = [...document.querySelectorAll('.locus-name')];
    const positions = [...document.querySelectorAll('.locus-pos')];
    return {
      title: document.querySelector('#palace-title').value,
      loci: names.map((input, index) => ({
        name: input.value,
        position: Number(positions[index].value)
      })),
      example: false
    };
  }

  function saveImage() {
    const fields = {
      numberImage: document.querySelector('#num-image').value,
      cardImage: document.querySelector('#card-image').value,
      scene: document.querySelector('#scene-text').value
    };
    ctx.imageDrafts.set(ctx.imagePos, fields);
    const candidate = structuredClone(ctx.state);
    const mnemonic = candidate.progress[ctx.state.selected].mnemonics;
    mnemonic.images[String(ctx.imagePos)] = fields;
    candidate.progress[ctx.state.selected].notes[String(ctx.imagePos)] = fields.scene;
    if (!commitMemory(candidate))
      return;
    ctx.imageDrafts.delete(ctx.imagePos);
    savedNote(`${ ctx.imagePos }번 장면을 저장했습니다.`);
  }

  function savePalace() {
    const raw = readPalaceRaw();
    const loci = raw.loci.map(locus => ({
      name: locus.name.trim(),
      position: locus.position
    })).filter(locus => locus.name);
    const candidate = structuredClone(ctx.state);
    candidate.progress[ctx.state.selected].mnemonics.palace = {
      title: raw.title.trim(),
      loci: loci
    };
    if (!commitMemory(candidate))
      return;
    ctx.palaceDraft = null;
    ctx.renderMemory();
    savedNote('궁전을 이 스택에 저장했습니다.');
  }

  function saveStory() {
    try {
      const [start, end] = memoryRangeValues();
      const text = document.querySelector('#story-text').value;
      groupPositions(start, end);
      ctx.memoryStart = start;
      ctx.memoryEnd = end;
      ctx.storyDraft = {
        start: start,
        end: end,
        text: text
      };
      const candidate = structuredClone(ctx.state);
      const stories = candidate.progress[ctx.state.selected].mnemonics.stories.filter(story => !(story.start === start && story.end === end));
      stories.push({
        start: start,
        end: end,
        text: text
      });
      candidate.progress[ctx.state.selected].mnemonics.stories = stories;
      if (!commitMemory(candidate))
        return;
      ctx.storyDraft = null;
      ctx.renderMemory();
      savedNote('이야기를 이 스택에 저장했습니다.');
    } catch (error) {
      ctx.message(error.message);
    }
  }

  function deleteStory() {
    const candidate = structuredClone(ctx.state);
    candidate.progress[ctx.state.selected].mnemonics.stories = candidate.progress[ctx.state.selected].mnemonics.stories.filter(story => !(story.start === ctx.memoryStart && story.end === ctx.memoryEnd));
    if (!commitMemory(candidate))
      return;
    ctx.storyDraft = null;
    ctx.renderMemory();
    savedNote('이 범위의 이야기를 지웠습니다.');
  }

  return { commitMemory, pack, imageFields, sceneText, numberImageFor, cardImageFor, savedNote, memoryRangeValues, memRangeHTML, stageName, storyTextFor, palaceModel, readPalaceRaw, saveImage, savePalace, saveStory, deleteStory };
}
