// scripts/seed-event-photos.mjs
//
// 목적: 모임 후기 작성용 사진 풀을 event_photos 테이블에 등록함.
//
// 사용법:
// SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
// node scripts/seed-event-photos.mjs 2026-08-meeting ./event-photos-2026-08.json
//
// dry-run:
// node scripts/seed-event-photos.mjs 2026-08-meeting ./event-photos-2026-08.json --dry-run

import fs from 'node:fs/promises';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => !arg.startsWith('--'));

const [eventCode, jsonPath] = positional;

if (!eventCode || !jsonPath) {
  console.error('사용법: node scripts/seed-event-photos.mjs <event_code> <json_path> [--dry-run]');
  process.exit(1);
}

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SECRET_KEY || '').trim();

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  console.error('SUPABASE_URL 또는 SUPABASE_SECRET_KEY 환경변수가 없음');
  process.exit(1);
}

function assertValidUrl(value, fieldName) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error(`${fieldName} URL 형식이 잘못됨: ${value}`);
  }
}

function readString(photo, names) {
  for (const name of names) {
    if (typeof photo[name] === 'string' && photo[name].trim()) {
      return photo[name].trim();
    }
  }
  return '';
}

function normalizeStatus(photo) {
  if (typeof photo.status === 'string' && photo.status.trim()) {
    const status = photo.status.trim();
    if (!['visible', 'hidden'].includes(status)) {
      throw new Error(`status는 visible 또는 hidden이어야 함: ${status}`);
    }
    return status;
  }
  return photo.is_active === false ? 'hidden' : 'visible';
}

function normalizePhoto(photo, index) {
  if (!photo || typeof photo !== 'object') {
    throw new Error(`${index + 1}번째 사진 항목이 객체가 아님`);
  }

  const imageSrc = readString(photo, ['image_src', 'image_url']);
  if (!imageSrc) {
    throw new Error(`${index + 1}번째 사진 항목에 image_src 또는 image_url이 없음`);
  }
  assertValidUrl(imageSrc, 'image_src');

  const altText = readString(photo, ['alt_text', 'caption']) || `${eventCode} 사진 ${index + 1}`;

  return {
    event_code: eventCode,
    image_src: imageSrc,
    alt_text: altText,
    sort_order: Number.isInteger(photo.sort_order)
      ? photo.sort_order
      : index + 1,
    status: normalizeStatus(photo),
  };
}

const raw = await fs.readFile(jsonPath, 'utf8');
const parsed = JSON.parse(raw);

if (!Array.isArray(parsed)) {
  console.error('사진 JSON은 배열이어야 함');
  process.exit(1);
}

const rows = parsed.map(normalizePhoto);

if (rows.length === 0) {
  console.error('등록할 사진이 없음');
  process.exit(1);
}

const imageSrcs = rows.map((row) => row.image_src);
const uniqueImageSrcs = new Set(imageSrcs);
if (uniqueImageSrcs.size !== imageSrcs.length) {
  console.error('사진 JSON 안에 중복된 image_src/image_url이 있음');
  process.exit(1);
}

if (dryRun) {
  console.log(`[dry-run] event_photos ${rows.length}개 검증 완료함`);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existingRows, error: existingError } = await supabase
  .from('event_photos')
  .select('id,image_src')
  .eq('event_code', eventCode)
  .in('image_src', imageSrcs);

if (existingError) {
  console.error('event_photos 기존 행 조회 실패함');
  console.error(existingError);
  process.exit(1);
}

const existingByImageSrc = new Map((existingRows || []).map((row) => [row.image_src, row]));
const savedRows = [];
let inserted = 0;
let updated = 0;

for (const row of rows) {
  const existing = existingByImageSrc.get(row.image_src);
  if (existing) {
    const { data, error } = await supabase
      .from('event_photos')
      .update({
        alt_text: row.alt_text,
        sort_order: row.sort_order,
        status: row.status,
      })
      .eq('id', existing.id)
      .select('id,event_code,image_src,sort_order,status')
      .single();

    if (error) {
      console.error('event_photos update 실패함');
      console.error(error);
      process.exit(1);
    }
    savedRows.push(data);
    updated += 1;
    continue;
  }

  const { data, error } = await supabase
    .from('event_photos')
    .insert(row)
    .select('id,event_code,image_src,sort_order,status')
    .single();

  if (error) {
    console.error('event_photos insert 실패함');
    console.error(error);
    process.exit(1);
  }
  savedRows.push(data);
  inserted += 1;
}

console.log(`event_photos ${savedRows.length}개 저장 완료함: inserted=${inserted}, updated=${updated}`);
