// scripts/check-env.mjs
//
// 목적: Supabase/Netlify 실서비스 전에 필수 환경변수 누락과
// publishable key / secret key 혼동을 줄임.

import process from 'node:process';

const REQUIRED_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MAGIC_PLAYGROUND_ADMIN_EMAILS',
];

function getEnv(key) {
  return (process.env[key] || '').trim();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikeSupabaseUrl(value) {
  return /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(value);
}

function looksLikeJwt(value) {
  return /^eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}$/.test(value);
}

function looksLikePublishableKey(value) {
  return value.startsWith('sb_publishable_') || looksLikeJwt(value);
}

function looksLikeSecretKey(value) {
  return value.startsWith('sb_secret_') || looksLikeJwt(value);
}

const missing = REQUIRED_ENV_KEYS.filter((key) => !getEnv(key));
const failures = [];
const warnings = [];

if (missing.length > 0) {
  for (const key of missing) failures.push(`필수 환경변수 누락됨: ${key}`);
}

const supabaseUrl = getEnv('SUPABASE_URL');
const publishableKey = getEnv('SUPABASE_PUBLISHABLE_KEY');
const secretKey = getEnv('SUPABASE_SECRET_KEY');
const adminEmailsRaw = getEnv('MAGIC_PLAYGROUND_ADMIN_EMAILS');

if (supabaseUrl && !looksLikeSupabaseUrl(supabaseUrl)) {
  warnings.push('SUPABASE_URL이 일반적인 Supabase URL 형식이 아님');
}

if (publishableKey && secretKey && publishableKey === secretKey) {
  failures.push('SUPABASE_PUBLISHABLE_KEY와 SUPABASE_SECRET_KEY가 같음');
}

if (publishableKey && /service_role|sb_secret_/i.test(publishableKey)) {
  failures.push('SUPABASE_PUBLISHABLE_KEY에 secret/service role로 보이는 값이 들어감');
}

if (secretKey && /sb_publishable_/i.test(secretKey)) {
  failures.push('SUPABASE_SECRET_KEY에 publishable key로 보이는 값이 들어감');
}

if (publishableKey && !looksLikePublishableKey(publishableKey)) {
  warnings.push('SUPABASE_PUBLISHABLE_KEY가 일반적인 Supabase key 형식으로 보이지 않음');
}

if (secretKey && !looksLikeSecretKey(secretKey)) {
  warnings.push('SUPABASE_SECRET_KEY가 일반적인 Supabase key 형식으로 보이지 않음');
}

const adminEmails = adminEmailsRaw
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean);

if (adminEmailsRaw && adminEmails.length === 0) {
  failures.push('MAGIC_PLAYGROUND_ADMIN_EMAILS에 유효한 이메일이 없음');
}

for (const email of adminEmails) {
  if (!looksLikeEmail(email)) {
    failures.push(`관리자 이메일 형식이 이상함: ${email}`);
  }
}

if (warnings.length > 0) {
  console.warn('환경변수 경고 있음');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length > 0) {
  console.error('환경변수 검사 실패함');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`환경변수 검사 통과함: adminEmails=${adminEmails.length}`);
