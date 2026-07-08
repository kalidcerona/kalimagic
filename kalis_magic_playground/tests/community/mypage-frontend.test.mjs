import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
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
  assert.match(js, /role:\s*'expert'/);
  assert.match(js, /role:\s*'member'/);
  assert.match(js, /전문가 부여/);
  assert.match(js, /전문가 해제/);
  assert.match(js, /admin\|kali/);
});

test('nav exposes mypage link only through the logged-in branch', () => {
  const js = source('nav.js');

  assert.match(js, /MagicAuth\.getSession/);
  assert.match(js, /mypage\.html/);
  assert.match(js, /마이페이지/);
});
