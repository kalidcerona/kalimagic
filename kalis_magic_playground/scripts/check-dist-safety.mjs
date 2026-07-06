// scripts/check-dist-safety.mjs
//
// 목적:
// dist/에 비공개 문서, 서버 코드, Supabase migration, 테스트 파일,
// 환경변수, secret key 흔적이 섞였는지 검사함.
//
// 사용법:
// node scripts/check-dist-safety.mjs
// node scripts/check-dist-safety.mjs --dist public

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const distArgIndex = args.indexOf('--dist');
const distDirFromArg = distArgIndex >= 0 ? args[distArgIndex + 1] : null;

const DIST_DIR = path.resolve(distDirFromArg || 'dist');

const FORBIDDEN_PATH_PARTS = [
  '.env',
  'supabase',
  'migrations',
  'netlify/functions',
  'tests',
  'node_modules',
  'COMMUNITY-MVP-DESIGN.md',
  'MAGIC-PLAYGROUND-PRD.md',
  'MAGIC-PLAYGROUND-IMPLEMENTATION-PLAN.md',
  'MAGIC-PLAYGROUND-RUNBOOK.md',
];

const FORBIDDEN_TEXT_PATTERNS = [
  { name: 'SUPABASE_SECRET_KEY literal', re: /SUPABASE_SECRET_KEY/i },
  { name: 'SUPABASE_SERVICE_ROLE literal', re: /SUPABASE_SERVICE_ROLE/i },
  { name: 'service_role literal', re: /service_role/i },
  { name: 'MAGIC_PLAYGROUND_ADMIN_EMAILS literal', re: /MAGIC_PLAYGROUND_ADMIN_EMAILS/i },
  { name: 'private key block', re: /BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY/i },
  { name: 'Supabase secret token', re: /sb_secret_[a-zA-Z0-9_-]+/i },
  { name: 'JWT-like token', re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/ },
];

const TEXT_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.txt', '.md', '.map', '.xml', '.svg', '.webmanifest',
]);

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

function toPosix(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function relativeFromCwd(inputPath) {
  return toPosix(path.relative(process.cwd(), inputPath));
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function getEnvSecretValues() {
  return [
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_KEY,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length >= 16);
}

function hasContiguousSegments(segments, forbiddenSegments) {
  return segments.some((_, startIndex) => (
    forbiddenSegments.every((part, offset) => segments[startIndex + offset] === part)
  ));
}

function pathContainsForbiddenPart(relativePath) {
  const segments = relativePath.split('/').filter(Boolean);
  return FORBIDDEN_PATH_PARTS.filter((forbidden) => {
    const normalizedForbidden = toPosix(forbidden);
    if (normalizedForbidden === '.env') {
      return segments.some((segment) => segment === '.env' || segment.startsWith('.env.'));
    }
    const forbiddenSegments = normalizedForbidden.split('/').filter(Boolean);
    return hasContiguousSegments(segments, forbiddenSegments);
  });
}

async function readTextIfSafe(filePath) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_TEXT_FILE_BYTES) return null;
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return null;
  return fs.readFile(filePath, 'utf8');
}

if (!await exists(DIST_DIR)) {
  console.error(`dist 안전 검사 실패함: ${relativeFromCwd(DIST_DIR)} 폴더가 없음`);
  console.error('먼저 npm run build 실행 필요함');
  process.exit(1);
}

const files = await walk(DIST_DIR);
const failures = [];
const envSecretValues = getEnvSecretValues();

for (const file of files) {
  const relative = relativeFromCwd(file);
  const forbiddenPathParts = pathContainsForbiddenPart(relative);
  for (const forbidden of forbiddenPathParts) {
    failures.push(`금지된 경로 포함: ${relative} / matched=${forbidden}`);
  }
  const text = await readTextIfSafe(file);
  if (text === null) continue;
  for (const { name, re } of FORBIDDEN_TEXT_PATTERNS) {
    if (re.test(text)) {
      failures.push(`금지된 문자열 패턴 발견: ${relative} / ${name}`);
    }
  }
  for (const secretValue of envSecretValues) {
    if (text.includes(secretValue)) {
      failures.push(`실제 secret 환경변수 값 노출 의심: ${relative}`);
    }
  }
}

if (failures.length > 0) {
  console.error('dist 안전 검사 실패함');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`dist 안전 검사 통과함: ${relativeFromCwd(DIST_DIR)} / files=${files.length}`);
