
// Hotel stage (2026-10-26): the new venue 「호텔 마술 대회」 after 대학 축제, and 「TV 오디션」 rewritten as the preliminary round (vault 설계/
// 「칼리 마술 성장기 새 무대 대본 초안 - 호텔 마술 대회와 TV 오디션 (2026-10-26)」, owner answers 10-26). Saves keep the slug order: a save
// written before this block is renumbered on load (core.js migrateHotelSave). a19, a64, a21 and a65 move from audition to hotel with their ids;
// the four new faces reuse an existing portrait until their art is installed (portraitAsset below).
(function (D) {
  const S = D.storyV15, F = D.lineFaces;
  const L = rows => rows.map(([speaker, text, mood, id]) => Object.assign({ speaker, text, mood }, id ? { id } : {}));
  const bySlug = slug => D.venues.find(v => v.slug === slug);
  const audition = bySlug('audition'), old = Object.fromEntries(audition.audiences.map(a => [a.id, a]));
  const oldHeckles = new Map();
  const lines = (a, encounterLine, heckles, missLine, winLine) => {
    oldHeckles.set(a.id, (a.heckles || []).slice());
    return Object.assign(a, { encounterLine, heckles, missLine, winLine });
  };
  const fresh = (id, name, emoji, flavor, role, portraitAsset, extra) => ({ id, name, emoji, portraitAsset, flavor, extra, bio: flavor, role });
  // 호텔 마술 대회 (new venue)
  const hotelAud = [
    lines(Object.assign(old.a19, { flavor: '행사 사회를 맡은 칼리의 친구.', bio: '구경 온 칼리를 즉석 참가자로 부른 친구.' }), '다음 참가자입니다, 칼리!', ['준비 시간은 없다, 친구야!', '다들 즉석인 거 알아요.', '심사위원님 기다리신다, 빨리!'], '아, 내가 너무 갑자기 불렀나.', '역시 내 친구, 부르길 잘했다!'),
    lines(Object.assign(old.a64, { flavor: '연회장을 안내하는 직원.', bio: '연회장을 안내하고 의자를 더 놓는 직원.' }), '이 연회장에서 공연하시면 돼요.', ['의자 더 놓을까요? 사람 몰려요!', '손님이 웃고 계세요.', '다음 순서 시간, 다 돼 가요!'], '아, 정리하느라 끝을 못 봤네요.', '샹들리에보다 반짝였어요!'),
    lines(Object.assign(old.a21, { flavor: '일본에서 온 마술사 참가자.', bio: '일본에서 온 마술사 참가자.' }), '한국 마술, 처음 봐요.', ['그 기술, 일본에도 있어요?', '오오, 저도 빨리 보고 싶어요.', '천천히요! 메모하고 싶어요.'], '아, 조금만 더 보고 싶었어요.', '오늘 많이 배웠습니다.'),
    lines(fresh('a-hotel-neighbor', '옆자리 참가자', '🎴', '칼리 바로 앞 순서의 참가자.', 'skeptic', 'aud-hotel-neighbor.png', { type: 'noDamage', value: 0 }), '제 바로 다음 순서시네요?', ['즉석인데 소품은 있어요?', '제 무대보다 반응 좋으면 곤란한데!', '그 카드, 제 덱에서 간 거 아니죠?'], '아, 제가 더 긴장했나 봐요.', '같은 참가자로서 박수 보내요!'),
    lines(Object.assign(old.a65, { flavor: '연회장 문 앞에서 멈춘 손님.', bio: '호텔에 묵다가 연회장 문 앞에서 멈춘 손님.' }), '지나가다 멈췄어요.', ['표 없는데 봐도 되나여?', '진짜 즉석 맞아요?', '문 앞에서도 잘 보여요.'], '아, 멈춘 김에 끝까지 볼걸.', '멈춰서 보길 잘했어요.')
  ];
  const hotelHead = lines({ id: 'h-hotel', name: '일본 지역 마술 협회장', emoji: '🎖️', portraitAsset: 'headliner-hotel.png', flavor: '오늘 대회의 심사위원장.', bio: '오늘 대회의 심사위원장.', role: 'critic', pattern: 'sealBox' },
    '즉석 참가자라니, 궁금하네요.', ['심사는 꼼꼼히 합니다.', '방금 그 카드, 다시 볼까요?', '남은 시간 1분입니다.'], '아쉽네요. 끝까지 보고 싶었는데.', '즉석이라고 믿기지 않네요.');
  Object.assign(hotelHead, { preLine: hotelHead.encounterLine, defeatLine: '3등입니다. 축하해요.' });
  const hotel = { id: 0, balanceRank: 6.5, economyRank: 6.5, hpFactor: 44000, venueAsset: 'venue-07a-hotel.png', crowdAsset: 'crowd-07.png', slug: 'hotel', crowd: 50, crowdEmoji: '🏨🃏🎩👏',
    name: '호텔 마술 대회', intro: '다음 참가자입니다, 칼리!', palette: { bg1: '#22160e', bg2: '#6e4f2a', accent: '#ffd98a' }, successLine: '3등입니다. 축하해요.', trophy: '호텔 대회 3등',
    headliner: hotelHead, audiences: hotelAud };
  // TV 오디션 (the preliminary round)
  const auditionAud = [
    lines(fresh('a-audition-fd', 'FD님', '📋', '번호표를 나눠 주고 순서를 부르는 스태프.', 'helper', 'aud-audition-fd.png', { type: 'timeLimit', value: 75 }), '127번 참가자님, 무대로요!', ['1분이에요, 시계 보세요!', '큐 들어갑니다, 바로요!', '다음 번호 대기 중이에요!'], '아, 큐 주느라 못 봤네요.', '오늘 예선 중에 제일 깔끔했어요!'),
    lines(fresh('a-audition-waiting', '대기실 참가자', '🎤', '칼리 바로 앞 번호의 노래 참가자.', 'supporter', 'aud-audition-waiting.png', { type: 'combo', value: 15 }), '저 바로 앞 번호예요, 떨려요.', ['저보다 덜 떠시네요?', '카드 말고 제 가사 좀 찾아 줘요!', '소매에 뭐 있죠? 다 봤어요!'], '아, 제 차례 생각하다 놓쳤어요.', '덕분에 저도 하나도 안 떨려요!'),
    lines(Object.assign(old.a20, { flavor: '예선 녹화 카메라를 맡은 감독.', bio: '예선 녹화 카메라를 맡은 감독.' }), '예선 녹화, 지금부터 돌아요.', ['카메라엔 다 찍힌다?', '컷 날 때까지 그대로요.', '줌 들어가요, 천천히요!'], '아, 좋은 장면 놓쳤네.', '이 컷, 본방에 살릴게요.'),
    lines(Object.assign(old.a66, { flavor: '예선 방청석에서 먼저 웃는 관객.', bio: '예선 방청석에서 먼저 웃는 관객.' }), '웃어도 되는 장면이죠?', ['ㅋㅋㅋ 또 웃음이 나와요.', '웃다가 놓치면 책임져요!', '끝나면 크게 박수 칠게요.'], '아, 웃다가 끝을 놓쳤어요.', '웃다가 박수까지 쳤어요.')
  ];
  lines(Object.assign(audition.headliner, { flavor: '1분 예선을 재는 심사위원장.', bio: '1분 예선을 재는 TV 오디션 심사위원장.' }), '1분 드립니다. 시작하세요.', ['첫 10초, 벌써 지났어요.', '그 카드, 카메라에도 보일까요?', '30초 남았습니다.'], '아쉽네요. 1분이 너무 짧았어요.', '1분이 이렇게 짧을 줄이야.');
  Object.assign(audition.headliner, { preLine: audition.headliner.encounterLine, defeatLine: '예선 통과입니다. 본선에서 봬요.' });
  audition.audiences.splice(0, audition.audiences.length, ...auditionAud);
  Object.assign(audition, { intro: '127번 참가자님, 무대로요!', successLine: '예선 통과입니다. 본선에서 봬요.', trophy: '예선 통과' });
  D.venues.splice(D.venues.indexOf(bySlug('festival')) + 1, 0, hotel);
  D.venues.forEach((v, i) => { v.id = i + 1; });
  // Story scenes, curtain calls and fight lines (draft sections 1 and 2, verbatim).
  const insertAfter = (obj, after, key, value) => { const entries = Object.entries(obj).filter(([k]) => k !== key); Object.keys(obj).forEach(k => delete obj[k]); for (const [k, v] of entries) { obj[k] = v; if (k === after) obj[key] = value; } };
  insertAfter(S.venues, 'festival', 'hotel', {
    opening: L([['칼리', '일본 마술사분들이 서울 호텔 연회장에서 마술 대회를 연다길래 구경 왔어요. 문만 살짝 열고 들어왔는데요.', 'serious'], ['진행자 친구', '다음 참가자입니다, 칼리!', 'serious', 'a19'], ['칼리', '네? 저 구경하러 온 건데요?', 'surprised'], ['진행자 친구', '마침 한 자리가 비었거든. 너라면 바로 할 수 있잖아.', 'happy', 'a19'], ['일본 지역 마술 협회장', '막 도착한 참가자라니, 반갑습니다. 그래도 무대는 제대로 보겠습니다.', 'serious', 'h-hotel'], ['카드1412', '즉흥도 실력인 거예유. 형이면 할 수 있당.', 'serious'], ['세로나', '칼리씨, 갑자기라 떨리죠. 괜찮아요, 늘 하던 대로 앞에 계신 한 분부터 봐요.', 'serious', 'a-lecturenote-serona']]),
    beforeHeadliner: L([['카드1412', '첫 장면만 기억하면 돼유. 나머진 형 몸이 알아유.', 'serious'], ['칼리', '대본은 없지만 할 말은 있어요. 관객분들이랑 같이 웃으면서 가 볼게요.', 'happy'], ['진행자 친구', '다들 네가 막 도착한 거 알아. 편하게 해, 칼리.', 'serious', 'a19'], ['칼리 열혈팬 1223호', '칼리님, 진짜 마술대회에 나오셨네요! 평소 템포로 가 주세요!', 'happy', 'a16'], ['밍기리', '반짝반짝... 방. 마술사... 많다. 재밌다.', 'happy'], ['일본 지역 마술 협회장', '이제 마지막 무대만 남았습니다. 심사위원석에서 보겠습니다.', 'serious', 'h-hotel']]),
    afterClear: L([['일본 지역 마술 협회장', '막 도착해서 바로 올라온 무대였는데, 오늘 가장 기억에 남는 3등이에요. 다음엔 준비한 무대로도 보고 싶네요.', 'happy', 'h-hotel'], ['칼리 열혈팬 1223호', '즉석으로 3등이라니요! 다음 대회도 따라갈게요!', 'happy', 'a16'], ['칼리', '갑자기 불려 나가서 더 기억에 남네요. 다음엔 미리 말해 줘요. ㅋㅋ', 'happy'], ['진행자 친구', '미리 말했으면 안 왔을 거잖아.', 'happy', 'a19'], ['카드1412', '갑자기 나갔는데 잘했어유.', 'happy'], ['칼리', '그래도 무대에 서니까 정말 즐거웠어요. 다음엔 구경 말고, 제가 직접 신청해서 나가 볼래요.', 'serious']])
  });
  Object.assign(S.venues.audition, {
    opening: L([['칼리', '이번엔 제가 직접 신청했어요. TV 오디션 예선, 번호표도 받았고요.', 'happy'], ['FD님', '127번 참가자님, 다음 순서입니다! 무대 옆에서 대기해 주세요.', 'serious', 'a-audition-fd'], ['대기실 참가자', '저 손 떨리는 거 보여요? 노래 참가자인데 가사가 하나도 생각 안 나요.', 'surprised', 'a-audition-waiting'], ['칼리', '저도 떨려요. 그래도 떨린다는 건 그만큼 보여 주고 싶다는 거래요.', 'serious'], ['심사위원장', '시간은 1분입니다. 첫 10초 안에 무엇을 보여 줄지 정하고 오세요.', 'serious', 'h7'], ['칼리 열혈팬 1223호', '칼리님, 방청석에서 응원해요!', 'happy', 'a16'], ['세로나', '칼리씨, 이번엔 스스로 고른 무대예요. 그것만으로도 벌써 멋져요.', 'happy', 'a-lecturenote-serona']]),
    beforeHeadliner: L([['FD님', '127번, 스탠바이! 심사위원님들 다 보고 계세요.', 'serious', 'a-audition-fd'], ['칼리', '1분이면 짧지만, 한 분 웃게 하기엔 충분해요.', 'serious'], ['칼리 열혈팬 1223호', '칼리님, 호텔에서처럼만 하면 돼요!', 'happy', 'a16'], ['밍기리', '빨간 불... 켜졌다. 칼리... 괜찮다.', 'serious'], ['심사위원장', '좋아요. 마지막 1분, 지금부터 재겠습니다.', 'serious', 'h7']]),
    afterClear: L([['심사위원장', '1분 동안 방청석이 세 번 웃었어요. 그게 오늘 통과한 이유예요. 본선 녹화에서 다시 봐요.', 'happy', 'h7'], ['대기실 참가자', '저도 붙었어요! 칼리 씨 무대 보고 나니까 손 떨림이 멈췄어요.', 'happy', 'a-audition-waiting'], ['칼리', '직접 신청한 무대라 그런지 통과가 더 기뻐요. 같이 붙어서 더 좋고요.', 'happy'], ['세로나', '축하해요, 칼리씨. 다음은 진짜 방송이에요. 오늘처럼 한 분씩 보면 돼요.', 'happy', 'a-lecturenote-serona'], ['밍기리', '방송... 처음. 칼리... 같이 간다.', 'happy']])
  });
  insertAfter(S.cheers, 'festival', 'hotel', { title: '호텔 마술 대회의 박수', lines: L([['진행자 친구', '짝짝짝! 내 친구 최고!', 'happy', 'a19'], ['호텔 직원', '짝짝짝! 오늘 연회장이 제일 뜨거워요!', 'happy', 'a64'], ['일본 참가자', '짝짝짝! 스고이! 대단해요!', 'surprised', 'a21'], ['옆자리 참가자', '짝짝짝! 다음 대회도 같이 나가요!', 'happy', 'a-hotel-neighbor'], ['구경 온 손님', '짝짝짝! 지나가다 횡재했어요!', 'happy', 'a65'], ['일본 지역 마술 협회장', '짝짝짝! 즉석 참가로 3등, 대단합니다!', 'happy', 'h-hotel']]) });
  S.cheers.audition = { title: 'TV 오디션의 박수', lines: L([['FD님', '짝짝짝! 큐 시트에 별표 쳤어요!', 'happy', 'a-audition-fd'], ['대기실 참가자', '짝짝짝! 저도 붙을 것 같아요!', 'happy', 'a-audition-waiting'], ['카메라 감독님', '짝짝짝! 오늘 최고의 컷이에요!', 'happy', 'a20'], ['웃음 많은 관객', '짝짝짝! 배꼽 빠지겠어요!', 'happy', 'a66'], ['심사위원장', '짝짝짝! 본선 무대가 기대돼요!', 'happy', 'h7']]) };
  // Owner 10-26: 비법 「콜드 오픈」 moves to the hotel, TV 오디션 gets 「콜백」.
  S.secretSkills.audition = '콜백'; insertAfter(S.secretSkills, 'festival', 'hotel', '콜드 오픈');
  // Owner 10-26 answer 4: the TV 방송 PD's first line (also the venue intro).
  const broadcast = bySlug('broadcast'); S.venues.broadcast.opening[0].text = '오늘은 TV 방송이에요.'; broadcast.intro = S.venues.broadcast.opening[0].text;
  // Owner 10-26 answer 7: every venue's own short arrival-banner line (20 characters or fewer, from that venue's first scene).
  const ARRIVAL = { family: '오빠, 학교에서 마술했다며?', party: '오늘 내 친구 생일이야.', school: '교실 젓가락 마술 소문 다 났어.', cafe: '혹시 마술 하나 보실래요?', meetup: '칼리야, 첫 모임이지?', theater: '첫 소극장 무대예요.',
    festival: '우리 학교 축제예요.', hotel: '호텔 연회장에 구경 왔어요.', audition: '이번엔 제가 직접 신청했어요.', broadcast: '오늘은 TV 방송이에요.', vegas: '라스베가스라니, 꿈같네요. ㄷㄷ', broadway: '선생님 공연이 생각나요.',
    moon: '달에서도 사람이 이렇게 모이다니.', sun: '태양이 눈부시네요. 그늘로 가요.', galaxy: '그늘을 따라 은하까지 왔어요.', multiverse: '나는 농장 게임만 하는 칼리야.', lecturenote: '카운터 안쪽까지 들어와 보래요.', future: '오, 많이 늘었네요.' };
  for (const v of D.venues) v.arrivalLine = ARRIVAL[v.slug];
  // Fight records, bios, face roles; heckle faces are kept only where the same text is still at that index (v6 rule).
  for (const a of [...hotelAud, hotelHead, ...auditionAud, audition.headliner]) {
    S.fights[a.id] = { heckles: a.heckles, winLine: a.winLine }; S.bios[a.id] = a.bio;
    F.roles[a.id] = Object.assign({}, F.roles[a.id] || { role: a.role, name: a.name }, { venue: hotelAud.includes(a) || a === hotelHead ? 'hotel' : 'audition' });
    const before = oldHeckles.get(a.id) || [], moods = before.map((_, i) => F.moods['fight:' + a.id + ':heckles:' + i]);
    before.forEach((_, i) => { delete F.moods['fight:' + a.id + ':heckles:' + i]; });
    a.heckles.forEach((text, i) => { const j = before.indexOf(text); if (j >= 0 && moods[j]) F.moods['fight:' + a.id + ':heckles:' + i] = moods[j]; });
    delete a._lineMood;
  }
  for (const k of Object.keys(F.moods)) if (k.startsWith('story:audition:')) delete F.moods[k]; // the audition scenes carry their own moods now
  // Achievements and gates keyed by venue: reach targets follow the slug; 「3등의 박수」 moves with the 3rd place to the hotel.
  const order = D.venues.map(v => v.slug);
  for (const a of D.achievements) if (a.metric === 'reach') a.target = order.indexOf({ 'reach-theater': 'theater', 'reach-vegas': 'vegas', 'reach-lecturenote': 'lecturenote' }[a.id]) + 1;
  const ca = D.achievements.find(a => a.id === 'clear-audition');
  D.achievements.splice(D.achievements.indexOf(ca), 0, { id: 'clear-hotel', name: ca.name, desc: hotel.name + ' 보스를 처음 만족시킨다.', description: hotel.name + ' 보스를 처음 만족시킨다.', group: '무대', hidden: false, metric: 'clear', target: 'hotel', legacy: false });
  ca.name = '예선 통과의 박수';
  D.tree.find(n => n.id === 'p-nao-card-tricks').venueSlug = 'hotel'; // its wall a21 (일본 참가자) is now the hotel gate
})(GAME_DATA);

// Owner-approved 10-26: only these nine experiences teach a story skill.
// Kept after the owner-rule secretSkill filter and hotel-stage script updates.
(function (D) {
  const S = D.storyV15;
  function mark(lines, text, slug) {
    const line = lines.find(l => l.text === text);
    if (!line) throw new Error('Missing skill moment: ' + slug);
    line.skillToast = slug;
  }
  mark(S.tutorial.schoolChain.girlClear, '그렇게 봐 주니까 하나도 안 떨렸어요. 눈을 마주치니까 같이 웃게 되네요.', 'tutorial');
  mark(S.venues.cafe.afterClear, 'TV로 봤을 때는 다 짜고 치는 줄 알았는데 실제로 보니까 너무 신기하네요', 'cafe');
  mark(S.venues.meetup.beforeHeadliner, '관객이 해낸 것처럼 보이게 하는 거군요. 저도 그렇게 해 볼게요.', 'meetup');
  mark(S.venues.theater.beforeHeadliner, '고르면 반은 성공한 거예유.', 'theater');
  mark(S.venues.theater.afterClear, '그날 검은괭이 형도 그랬어요. 밥 먹고 다시 서자고요. 오늘 다시 섰네요.', 'subway');
  mark(S.venues.hotel.afterClear, '갑자기 불려 나가서 더 기억에 남네요. 다음엔 미리 말해 줘요. ㅋㅋ', 'hotel');
  mark(S.venues.broadcast.afterClear, '그 말, 오래 기억할게요. 빠른 템포도 제 마술의 일부라고 생각하니까 든든해요.', 'broadcast');
  mark(S.venues.broadway.afterClear, '칼리씨가 속으로 한 대사가 무대 위에서 연기가 됐어요. 그게 이너 모놀로그예요.', 'broadway');
  mark(S.venues.moon.afterClear, '준비한 카드 대신 와이파이 마술로 바꿨어요. 원래 엔딩은 아니었는데, 반응은 더 좋네요. ㅋㅋ', 'moon');
  const closings = {
    family: '동생이 먼저 웃으니까 엄마도 따라 웃으시네요. 오늘 거실, 오래 기억날 것 같아요.',
    party: '한 번 더 보여 달라는 말, 이렇게 기분 좋은 줄 몰랐어요. 오늘은 제가 제일 신났던 것 같아요. ㅋㅋ',
    school: '선생님이 뿌듯하다고 하시니까 저도 뿌듯해요. 교실에서 시작한 마술이 축제 무대까지 왔네요.',
    festival: '멀리서 달려와 주시는 분들 덕분에 저도 힘이 났어요. 밝은 에너지는 옮는 거네요. ㅋㅋ',
    audition: '1분이 이렇게 짧은 줄 몰랐어요. 그래도 방청석에서 웃는 소리는 다 들렸어요.',
    vegas: '화면으로만 보던 분들 앞이라 꿈 같았어요. 저는 역시 웃기는 마술이 제일 즐거워요.',
    galaxy: '다음에 일본 가면 타코야키 줄에서 또 해 봐야겠어요. ㅋㅋ'
  };
  for (const [slug, text] of Object.entries(closings)) S.venues[slug].afterClear.push({ speaker: '칼리', text, mood: 'happy' });
  D.ifRouteScript.youngKaliDuel.afterClear.push({ speaker: '칼리', text: '어릴 때 저를 보니까, 왜 마술을 시작했는지 다시 생각나요.', mood: 'happy' });
  const mirror = D.ifRouteScript.mirrorStage.afterClear;
  mirror.splice(mirror.findIndex(l => l.speaker === '세로나'), 0, { speaker: '칼리', text: '완벽한 저도 한 사람씩 웃게 했네요. 그거라면 저도 할 수 있을 것 같아요.', mood: 'happy' });
  // Multiverse, lecturenote and future feed panels: keep their approved endings intact.
})(GAME_DATA);

// Future table (10-26): the two approved guests precede the headliner.
(function (D) {
  const v = D.venues.find(v => v.slug === 'future'), S = D.storyV15;
  const line = (speaker, text, mood = 'happy', id) => Object.assign({speaker, text, mood}, id ? {id} : {});
  v.crowd = 3;
  v.audiences = [
    {id:'a-future-student',name:'고등학생 관객',emoji:'🃏',portraitAsset:'aud-future-student.png',flavor:'마술을 막 시작한 고등학생.',bio:'마술을 시작한 지 한 달. 카드 마술을 배우고 있다.',extra:{type:'none',value:0},encounterLine:'마술 시작한 지 한 달 됐어요.',heckles:['잠깐만요, 방금 그거 패스죠?','한 번만 더, 천천히요!'],missLine:'아, 거의 따라갈 뻔했는데!',winLine:'제 카드가 휴대폰 케이스 뒤에!'},
    {id:'a-future-beginner',name:'초보 마술사',emoji:'🎩',portraitAsset:'aud-future-beginner.png',flavor:'마술 동아리에서 온 초보 마술사.',bio:'기술은 알지만 사람들 앞에서 보여 주는 법을 배우고 싶다.',extra:{type:'none',value:0},encounterLine:'기술은 좀 알아요. 보여 주는 건 어려워요.',heckles:['그 기술, 저도 연습 중이에요.','어디서 바꾸셨어요? 다시요!'],missLine:'아, 결정적인 순간을 놓쳤네요.',winLine:'이건 동아리에서도 못 봤어요!'}
  ];
  v.audiences.forEach(a => {
    a.role = 'supporter';
    S.bios[a.id] = a.bio;
    S.fights[a.id] = {encounterLine:a.encounterLine,heckles:a.heckles,missLine:a.missLine,winLine:a.winLine};
    D.lineFaces.roles[a.id] = {role:'supporter',name:a.name,venue:'future'};
  });
  const f = S.venues.future;
  f.opening.splice(0, f.opening.length,
    line('미래의 칼리','오, 많이 늘었네요. 계속 해 봐요.'),
    line('미래의 칼리','오늘은 이 테이블에 손님이 두 분 왔어요. 먼저 보여 줄래요? 저는 옆에서 볼게요.'),
    line('고등학생 관객','저 마술 시작한 지 한 달 됐어요. 처음이라 좀 떨려요.','sad','a-future-student'),
    line('칼리','저도 처음엔 그랬어요. 카드 한 장 골라 볼래요? 고른 카드, 잘 기억해 두세요.'),
    line('초보 마술사','저는 마술 동아리에서 왔어요. 기술은 좀 아는데, 보여 주는 게 어려워요.','serious','a-future-beginner'));
  f.beforeHeadliner.splice(0, f.beforeHeadliner.length,
    line('고등학생 관객','저도 언젠가 이렇게 보여 줄 수 있을까요?','serious','a-future-student'),
    line('미래의 칼리','그럼요. 저도 교실에서 젓가락 하나로 시작했거든요.'),
    line('미래의 칼리','좋아요. 이번엔 전화 마술 해 볼까요? 제가 제일 좋아하는 마술이에요.'),
    line('초보 마술사','고른 카드 이름으로 전화가 온다고요?','surprised','a-future-beginner'),
    line('미래의 칼리','네. 지금 그 속도 좋아요. 그대로 가요.'));
  f.afterClear.unshift(
    line('고등학생 관객','마술이 이렇게 편한 줄 몰랐어요.','happy','a-future-student'),
    line('미래의 칼리','이 테이블에서 마술을 보여 주고, 배운 걸 나누는 것. 그게 제가 찾은 행복이에요.'),
    line('세로나','이제 칼리씨의 마지막 한마디예요.'));
  S.cheers.future.lines.unshift(
    line('고등학생 관객','짝짝짝! 오늘부터 연습 두 배로 할래요!','happy','a-future-student'),
    line('초보 마술사','짝짝짝! 보여 주는 법을 배웠어요!','happy','a-future-beginner'));
  Object.assign(D.storyReview.future, {opening:f.opening,beforeHeadliner:f.beforeHeadliner,afterClear:f.afterClear});
})(GAME_DATA);
