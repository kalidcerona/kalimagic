// scripts/smoke-community-api.mjs
//
// 목적: Netlify deploy preview 또는 production URL에서 공개 API가 살아 있는지 확인함.
//
// 사용법:
// node scripts/smoke-community-api.mjs https://deploy-preview-url.netlify.app
// node scripts/smoke-community-api.mjs https://... --event-code 2026-08-meeting --timeout 8000

import process from 'node:process';

const args = process.argv.slice(2);
const baseUrl = args[0];

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  return args[index + 1] || fallback;
}

const eventCode = readOption('--event-code', '2026-08-meeting');
const timeoutMs = Number(readOption('--timeout', '8000'));

if (!baseUrl || baseUrl.startsWith('--')) {
  console.error('사용법: node scripts/smoke-community-api.mjs <base_url> [--event-code 2026-08-meeting] [--timeout 8000]');
  process.exit(1);
}

function buildUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

const endpoints = [
  { name: 'health', method: 'GET', path: '/.netlify/functions/health', expectStatus: [200] },
  { name: 'posts', method: 'GET', path: '/.netlify/functions/posts', expectStatus: [200] },
  {
    name: 'event photos',
    method: 'GET',
    path: `/.netlify/functions/event-photos?event_code=${encodeURIComponent(eventCode)}`,
    expectStatus: [200],
  },
];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

let failed = 0;

for (const endpoint of endpoints) {
  const url = buildUrl(endpoint.path);
  try {
    const res = await fetchWithTimeout(url, {
      method: endpoint.method,
      headers: { accept: 'application/json' },
    });
    const text = await res.text();
    if (!endpoint.expectStatus.includes(res.status)) {
      failed += 1;
      console.error(`[FAIL] ${endpoint.name}: status=${res.status} url=${url}`);
      console.error(text.slice(0, 800));
      continue;
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.warn(`[WARN] ${endpoint.name}: JSON 응답이 아닐 수 있음 content-type=${contentType}`);
    }
    console.log(`[OK] ${endpoint.name}: status=${res.status}`);
  } catch (error) {
    failed += 1;
    console.error(`[ERROR] ${endpoint.name}: url=${url}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`${failed}개 smoke test 실패함`);
  process.exit(1);
}

console.log('모든 smoke test 통과함');
