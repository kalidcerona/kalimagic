import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function extractedFunctionBundle(js, names, exportedName) {
  const parts = names.map((name) => {
    const start = js.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} should exist`);
    const bodyStart = js.indexOf('{', start);
    let depth = 0;
    for (let index = bodyStart; index < js.length; index += 1) {
      const char = js[index];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) return js.slice(start, index + 1);
      }
    }
    throw new Error(`Could not extract ${name}`);
  });
  return Function(`${parts.join('\n')}\nreturn ${exportedName};`)();
}

test('mypage html loads the shared auth/nav stack and mypage module', () => {
  const html = source('mypage.html');

  assert.match(html, /<div id="nav-root"><\/div>/);
  assert.match(html, /src="nav\.js"/);
  assert.match(html, /src="auth\.js"/);
  assert.match(html, /src="nickname-onboarding\.js"/);
  assert.match(html, /src="mypage\.js"/);
  assert.equal(
    html.indexOf('src="auth.js"') < html.indexOf('src="mypage.js"'),
    true,
    'auth.js should load before mypage.js'
  );
});

test('mypage module loads profile, handles auth, tabs, and post navigation', () => {
  const js = source('mypage.js');

  assert.match(js, /MagicAuth\.getSession/);
  assert.match(js, /MagicAuth\.login/);
  assert.match(js, /\/\.netlify\/functions\/profile/);
  assert.match(js, /\/\.netlify\/functions\/my-activity\?tab=/);
  assert.match(js, /data-mypage-tab="posts"/);
  assert.match(js, /data-mypage-tab="received"/);
  assert.match(js, /data-mypage-tab="given"/);
  assert.match(js, /post\.html\?id=/);
  assert.match(js, /encodeURIComponent\(id\)/);
  assert.match(js, /clickableCard\(card, item\.id\)/);
  assert.match(js, /clickableCard\(card, item\.postId\)/);
  assert.match(js, /이미 사용 중인 닉네임이에요/);
});

test('nickname onboarding checks nicknameSet once per session and handles duplicate nickname', () => {
  const js = source('nickname-onboarding.js');

  assert.match(js, /MagicAuth\.getSession/);
  assert.match(js, /\/\.netlify\/functions\/profile/);
  assert.match(js, /nicknameSet\s*===\s*false/);
  assert.match(js, /sessionStorage/);
  assert.match(js, /nickname-onboarding-shown/);
  assert.match(js, /커뮤니티에서 쓸 닉네임을 정해주세요/);
  assert.match(js, /이미 사용 중인 닉네임이에요/);
  assert.match(js, /error\.code\s*===\s*'nickname_taken'/);
});

test('playground, post, and mypage pages include nickname onboarding', () => {
  for (const path of ['playground.html', 'post.html', 'mypage.html']) {
    assert.match(source(path), /src="nickname-onboarding\.js"/, `${path} should load nickname onboarding`);
  }
});

test('admin front includes member management endpoints and role actions', () => {
  const html = source('admin.html');
  const js = source('admin.js');

  assert.match(html, /data-admin-filter="members"/);
  assert.match(html, /회원 관리/);
  assert.match(js, /\/\.netlify\/functions\/admin-members\?q=/);
  assert.match(js, /\/\.netlify\/functions\/admin-members/);
  assert.match(js, /memberRolePayload\(member,\s*targetRole\)/);
  assert.match(js, /role:\s*targetRole/);
  assert.match(js, /전문가 부여/);
  assert.match(js, /전문가 해제/);
  assert.match(js, /마술의 신 부여/);
  assert.match(js, /마술의 신 해제/);
  assert.match(js, /memberGodButton/);
  assert.match(js, /admin\|kali/);
});

test('mypage quest badges conceal unowned public badges from tier 3 upward', () => {
  const js = source('mypage.js');

  assert.match(js, /function shouldConcealQuestBadge\(badge\)/);
  assert.match(js, /!badge\.owned\s*&&\s*Number\(badge\.level\)\s*>=\s*3/);
  assert.match(js, /function questLockedTile\(badge\)/);
  assert.match(js, /quest-badge-tile--locked/);
  assert.match(js, /조건 획득 시 공개/);
  assert.match(js, /function visibleQuestBadges\(badges\)/);
  assert.match(js, /Number\(b\.level\)\s*===\s*3/);
  assert.match(js, /Number\(b\.level\)\s*!==\s*5\s*\|\|\s*tier3Owned/);
  assert.match(js, /visibleQuestBadges\(badges\)\.forEach\(function \(badge\)/);
  assert.match(js, /shouldConcealQuestBadge\(badge\)\s*\?\s*questLockedTile\(badge\)\s*:\s*questPublicTile\(badge\)/);
});

test('mypage sponsor coming-soon overlays show tier-specific amount copy', () => {
  const js = source('mypage.js');

  assert.match(js, /function comingSoonOverlayText\(code\)/);
  assert.match(js, /supporter_3000:\s*'3천원 후원시 공개'/);
  assert.match(js, /expert_3000:\s*'3천원 후원시 공개'/);
  assert.match(js, /supporter_10000:\s*'1만원 후원시 공개'/);
  assert.match(js, /expert_10000:\s*'1만원 후원시 공개'/);
  assert.match(js, /supporter_50000:\s*'5만원 후원시 공개'/);
  assert.match(js, /expert_50000:\s*'5만원 후원시 공개'/);
  assert.match(js, /return sponsorComingSoonOverlayText\[code\]\s*\|\|\s*'추후 공개'/);
  assert.match(js, /comingSoonOverlayText\(badge\.code\)/);
});

test('mypage badge ownership diff seeds first run and reports later new codes', () => {
  const js = source('mypage.js');
  const diffNewlyOwnedBadgeCodes = extractedFunctionBundle(
    js,
    ['uniqueBadgeCodes', 'diffNewlyOwnedBadgeCodes'],
    'diffNewlyOwnedBadgeCodes'
  );

  const firstRun = diffNewlyOwnedBadgeCodes(null, ['questions_1', 'questions_1']);
  assert.deepEqual(firstRun.newlyOwnedCodes, []);
  assert.deepEqual(firstRun.seenCodes, ['questions_1']);
  assert.equal(firstRun.seeded, true);

  const secondRun = diffNewlyOwnedBadgeCodes(['questions_1'], ['questions_1', 'answers_1']);
  assert.deepEqual(secondRun.newlyOwnedCodes, ['answers_1']);
  assert.deepEqual(secondRun.seenCodes, ['questions_1', 'answers_1']);
  assert.equal(secondRun.seeded, false);
});

test('nav exposes mypage link only through the logged-in branch', () => {
  const js = source('nav.js');

  assert.match(js, /MagicAuth\.getSession/);
  assert.match(js, /mypage\.html/);
  assert.match(js, /마이페이지/);
});
