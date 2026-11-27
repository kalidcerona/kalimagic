/* Server-only Apps Script. Never include this file in the public build. */
var SEMINAR_LEGACY_HEADERS = ['접수번호','접수 시각 (KST)','신청자명','입금자명','연락처 종류','연락처','선택 항목','입금할 금액','입금 기한 (KST)','행사 ID','항목 스냅샷','가격 버전','가격 구간','동의 버전','동의 시각','재시도 키','요청 지문','접수 시각 원본','입금 기한 원본','서버 기록','입금'];
var SEMINAR_HEADERS = SEMINAR_LEGACY_HEADERS.slice(0,-1).concat(['생년월일','성별','유입 경로','유입 경로 기타','신청 이유','신청 이유 기타','촬영 안내 버전','촬영 안내 확인 시각','입금']);
function seminarColumn(name) { return SEMINAR_HEADERS.indexOf(name); }
function seminarCell(row, name) { return row[seminarColumn(name)]; }
function seminarLetter(index) { var result = ''; for (index++; index > 0; index = Math.floor((index-1)/26)) result = String.fromCharCode(65+(index-1)%26)+result; return result; }
var SEMINAR_CONSENT_VERSION = '2026-11-30-v2';
var SEMINAR_PHOTO_CONSENT_VERSION = '2026-11-30-v2';
var SEMINAR_BASE_HEADERS = SEMINAR_HEADERS.slice();
function seminarSelectHeaders(eventId) { SEMINAR_HEADERS = eventId === 'cupsnballs' ? SEMINAR_BASE_HEADERS.slice(0,-1).concat(['만 14세 이상 확인','홍보용 사진 활용 동의','입금']) : SEMINAR_BASE_HEADERS.slice(); }
var SEMINAR_TAB = '신청 명단';
var SEMINAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var SEMINAR_HASH = /^[0-9a-f]{64}$/;
function seminarConfig(requestedEvent) {
  var props = PropertiesService.getScriptProperties();
  var deploymentEvent = props.getProperty('SEMINAR_EVENT_ID');
  var eventId = requestedEvent || deploymentEvent;
  if (requestedEvent && requestedEvent !== deploymentEvent) throw Error('invalid_event');
  var id = props.getProperty(eventId === 'cupsnballs' ? 'CUPSNBALLS_SHEET_ID' : 'SEMINAR_SHEET_ID');
  var secret = props.getProperty(eventId === 'cupsnballs' ? 'CUPSNBALLS_SHEETS_SIGNING_SECRET' : 'SEMINAR_SHEETS_SIGNING_SECRET');
  if (!id || !['daebeongae','cupsnballs'].includes(eventId) || !secret || Utilities.newBlob(secret).getBytes().length < 32) throw Error('not_configured');
  if (eventId === 'cupsnballs' && !/^2026-11-27-[0-9a-f]{12}$/.test(props.getProperty('CUPSNBALLS_CONSENT_VERSION') || '')) throw Error('not_configured');
  seminarSelectHeaders(eventId);
  return { props: props, id: id, eventId: eventId, secret: secret, tab:eventId === 'daebeongae' ? SEMINAR_TAB : '컵앤볼 신청 명단', capacity:eventId === 'daebeongae' ? 60 : null };
}
function seminarText(value) {
  var text = String(value == null ? '' : value);
  return /^[\s\u0000-\u001f\u007f]*[=+@-]/.test(text) ? "’" + text : text;
}
function seminarKst(value) { return Utilities.formatDate(new Date(value), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'); }
function seminarJson(result) { return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON); }
function seminarKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(function (key) { return allowed.indexOf(key) !== -1; });
}
function seminarString(value, max) { return typeof value === 'string' && value.length > 0 && Array.from(value).length <= max && !/[\u0000-\u001f\u007f]/.test(value); }
function seminarRecordValid(r, receivedAt, requireCurrentNotice, eventId) {
  var cups = eventId === 'cupsnballs';
  if (!seminarKeys(r, ['name','contactType','contact','payerName','items','total','version','tier','consentVersion','consentedAt','paymentDueAt','birthDate','gender','discovery','discoveryOther','reason','reasonOther','photoConsent','consent','photoConsentVersion','photoConsentedAt','ageConfirmed','promotionConsent'])) return false;
  if (!seminarString(r.name, 50) || !(r.payerName === null || r.payerName === '' || seminarString(r.payerName, 50))) return false;
  if (r.contactType !== 'phone' || typeof r.contact !== 'string' || !/^01[016789]\d{7,8}$/.test(r.contact)) return false;
  if (!(cups && r.birthDate === '') && (typeof r.birthDate !== 'string' || r.birthDate < '0001-01-01' || !/^\d{4}-\d{2}-\d{2}$/.test(r.birthDate))) return false;
  var birth = new Date(r.birthDate + 'T00:00:00Z');
  if (!(cups && r.birthDate === '') && (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0,10) !== r.birthDate || r.birthDate > seminarKst(receivedAt).slice(0,10))) return false;
  if (!(cups && r.gender === '') && !['male','female'].includes(r.gender) || !(cups && r.discovery === '') && !['instagram','youtube','referral','other'].includes(r.discovery) || !(cups && r.reason === '') && !['content','reviews','trust','other'].includes(r.reason)) return false;
  if (!cups && !(r.consentVersion === '2026-11-27-v1' && r.photoConsentVersion === '2026-11-27-v1')) {
    var today = seminarKst(receivedAt).slice(0,10);
    var cutoff = (Number(today.slice(0,4)) - 14) + today.slice(4);
    if (r.ageConfirmed !== true || r.birthDate > cutoff) return false;
  }
  if (cups && (typeof r.ageConfirmed !== 'boolean' || typeof r.promotionConsent !== 'boolean')) return false;
  if (r.photoConsent !== true || r.consent !== true || !seminarString(r.photoConsentVersion, 100) || r.photoConsentedAt !== r.consentedAt) return false;
  if (requireCurrentNotice && (cups ? (r.consentVersion !== PropertiesService.getScriptProperties().getProperty('CUPSNBALLS_CONSENT_VERSION') || r.photoConsentVersion !== PropertiesService.getScriptProperties().getProperty('CUPSNBALLS_CONSENT_VERSION')) : (r.consentVersion !== SEMINAR_CONSENT_VERSION || r.photoConsentVersion !== SEMINAR_PHOTO_CONSENT_VERSION))) return false;
  if (r.discovery === 'other' ? !seminarString(r.discoveryOther,100) || !r.discoveryOther.trim() : r.discoveryOther !== '') return false;
  if (r.reason === 'other' ? !seminarString(r.reasonOther,100) || !r.reasonOther.trim() : r.reasonOther !== '') return false;
  if (!seminarString(r.version, 100) || !seminarString(r.consentVersion, 100) || !['super','early','regular'].includes(r.tier)) return false;
  if (!Number.isFinite(Date.parse(receivedAt)) || Date.parse(r.consentedAt) !== Date.parse(receivedAt) || Date.parse(r.paymentDueAt) !== Date.parse(receivedAt) + 86400000) return false;
  if (!Array.isArray(r.items) || !r.items.length || r.items.length > 5) return false;
  var ids = [], sum = 0;
  var allowedIds = cups ? ['admission'] : ['bundle','special','lecture','show','meeting','open'];
  for (var i = 0; i < r.items.length; i++) {
    var item = r.items[i];
    if (!seminarKeys(item, ['id','label','name','quantity','unitPrice','price']) || !allowedIds.includes(item.id) || ids.includes(item.id) || item.quantity !== 1) return false;
    var price = item.unitPrice === undefined ? item.price : item.unitPrice;
    if (!Number.isSafeInteger(price) || price <= 0 || !seminarString(item.label || item.name, 100)) return false;
    if (item.price !== undefined && item.unitPrice !== undefined && item.price !== item.unitPrice) return false;
    ids.push(item.id); sum += price;
  }
  return Number.isSafeInteger(r.total) && Number.isSafeInteger(sum) && !(ids.length === 1 && ids[0] === 'open') && !(ids.includes('bundle') && ids.some(function (id) { return !['bundle','open'].includes(id); })) && r.total === sum;
}
function seminarRow(id, p) {
  var r = p.record;
  var cells = {
    '접수번호':id, '접수 시각 (KST)':seminarKst(p.receivedAt), '신청자명':seminarText(r.name),
    '입금자명':seminarText(r.payerName || r.name), '연락처 종류':r.contactType, '연락처':seminarText(r.contact),
    '선택 항목':r.items.map(function (item) { return item.label || item.name; }).join(' / '),
    '입금할 금액':r.total, '입금 기한 (KST)':seminarKst(r.paymentDueAt), '행사 ID':p.eventId,
    '항목 스냅샷':JSON.stringify(r.items), '가격 버전':r.version, '가격 구간':r.tier,
    '동의 버전':r.consentVersion, '동의 시각':r.consentedAt, '재시도 키':p.idempotencyKey,
    '요청 지문':p.fingerprint, '접수 시각 원본':p.receivedAt, '입금 기한 원본':r.paymentDueAt,
    '서버 기록':JSON.stringify(r), '생년월일':seminarText(r.birthDate), '성별':r.gender === 'male' ? '남자' : r.gender === 'female' ? '여자' : '',
    '유입 경로':({instagram:'인스타그램',youtube:'유튜브',referral:'지인 소개',other:'기타'})[r.discovery] || '',
    '유입 경로 기타':seminarText(r.discoveryOther),
    '신청 이유':(p.eventId === 'cupsnballs' ? {content:'처음 배워 보려고',reviews:'기본기를 다시 익히려고',trust:'강사와 수업 구성을 보고',other:'기타'} : {content:'인스타/유튜브 콘텐츠',reviews:'모임 리뷰/후기',trust:'칼리형에 대한 신뢰',other:'기타'})[r.reason] || '',
    '신청 이유 기타':seminarText(r.reasonOther), '촬영 안내 버전':r.photoConsentVersion,
    '촬영 안내 확인 시각':r.photoConsentedAt, '만 14세 이상 확인':r.ageConfirmed ? '확인' : '해당 없음', '홍보용 사진 활용 동의':r.promotionConsent ? '동의' : '미동의', '입금':0
  };
  return SEMINAR_HEADERS.map(function (header) { return cells[header]; });
}
function seminarReceipt(row) {
  var record = JSON.parse(seminarCell(row, '서버 기록'));
  return { id:seminarCell(row, '접수번호'),eventId:seminarCell(row, '행사 ID'),items:record.items,total:record.total,status:seminarCell(row, '입금') === 1 ? 'paid' : 'pending',createdAt:seminarCell(row, '접수 시각 원본'),payerName:record.payerName || record.name,paymentDueAt:seminarCell(row, '입금 기한 원본') };
}
function seminarRead(sheet, config) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 1 || JSON.stringify(values[0]) !== JSON.stringify(SEMINAR_HEADERS)) throw Error('invalid_sheet');
  var rows = values.slice(1), keys = {}, ids = {};
  rows.forEach(function (row) {
    if (row.length !== SEMINAR_HEADERS.length || !SEMINAR_UUID.test(seminarCell(row, '접수번호')) || seminarCell(row, '행사 ID') !== config.eventId || !SEMINAR_UUID.test(seminarCell(row, '재시도 키')) || !SEMINAR_HASH.test(seminarCell(row, '요청 지문')) || ![0,1].includes(seminarCell(row, '입금')) || keys[seminarCell(row, '재시도 키')] || ids[seminarCell(row, '접수번호')]) throw Error('invalid_sheet');
    var record = JSON.parse(seminarCell(row, '서버 기록'));
    if (!seminarRecordValid(record, seminarCell(row, '접수 시각 원본'),false,config.eventId)) throw Error('invalid_sheet');
    var expected = seminarRow(seminarCell(row, '접수번호'), {record:record,eventId:seminarCell(row, '행사 ID'),idempotencyKey:seminarCell(row, '재시도 키'),fingerprint:seminarCell(row, '요청 지문'),receivedAt:seminarCell(row, '접수 시각 원본')});
    expected.forEach(function (cell, index) {
      if (index === seminarColumn('입금')) return;
      if (row[index] !== cell) throw Error('invalid_sheet');
    });
    keys[seminarCell(row, '재시도 키')] = true; ids[seminarCell(row, '접수번호')] = true;
  });
  if (config.capacity !== null && rows.length > config.capacity) throw Error('invalid_sheet');
  return rows;
}
function seminarVerify(e, config, now) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 32768) throw Error('invalid_signature');
  var envelope = JSON.parse(e.postData.contents);
  if (!seminarKeys(envelope, ['version','timestamp','payload','signature']) || envelope.version !== 1 || !Number.isSafeInteger(envelope.timestamp) || Math.abs(now - envelope.timestamp) > 300000 || typeof envelope.payload !== 'string' || !SEMINAR_HASH.test(envelope.signature)) throw Error('invalid_signature');
  var bytes = Utilities.computeHmacSha256Signature('1\n' + envelope.timestamp + '\n' + envelope.payload, config.secret);
  var actual = bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  var mismatch = 0; for (var i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
  if (mismatch) throw Error('invalid_signature');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(envelope.payload)).getDataAsString('UTF-8'));
  if (!payload || payload.eventId !== config.eventId) throw Error('invalid_event');
  return payload;
}
function seminarRate(props, hash, now) {
  var all = props.getProperties(), count = 0, bytes = 0;
  Object.keys(all).forEach(function (key) {
    bytes += key.length + String(all[key]).length;
    if (key.indexOf('seminar_rate_') !== 0) return;
    var value = JSON.parse(all[key]);
    if (!value || !Number.isSafeInteger(value.count) || value.count < 1 || !Number.isSafeInteger(value.expires)) throw Error('limiter_failed');
    if (value.expires <= now) props.deleteProperty(key); else count++;
  });
  if (bytes > 400000 || count > 2000) throw Error('limiter_full');
  var key = 'seminar_rate_' + hash, current = props.getProperty(key);
  var value = current ? JSON.parse(current) : { count:0, expires:now + 600000 };
  if (value.count >= 10) return {ok:false,error:'rate_limited',retryAfter:Math.max(1,Math.ceil((value.expires - now)/1000))};
  value.count++; props.setProperty(key, JSON.stringify(value));
  return null;
}
function seminarExpandCups(sheet, neededRow) {
  var props=PropertiesService.getScriptProperties(), key='cups_sheet_prepared_rows';
  var maxRows=sheet.getMaxRows();
  if (neededRow <= maxRows && Number(props.getProperty(key)) === maxRows) return;
  if (maxRows < neededRow) sheet.insertRowsAfter(maxRows,Math.max(100,neededRow-maxRows));
  var count = sheet.getMaxRows()-1, column=seminarColumn('입금'), letter=seminarLetter(column);
  var payment=sheet.getRange(2,column+1,count,1);
  payment.setNumberFormat('0').setDataValidation(SpreadsheetApp.newDataValidation().requireFormulaSatisfied('=AND(ISNUMBER('+letter+'2),OR('+letter+'2=0,'+letter+'2=1))').setAllowInvalid(false).build());
  sheet.setConditionalFormatRules([SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$'+letter+'2=1').setBackground('#d9ead3').setRanges([sheet.getRange(2,1,count,SEMINAR_HEADERS.length)]).build()]);
  sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (protection) {protection.setUnprotectedRanges([payment]);});
  var filter=sheet.getFilter();
  if (!filter || filter.getRange().getNumRows() !== count+1) {
    var criteria=[], previousRange=filter && filter.getRange();
    if (filter) for (var col=1;col<=SEMINAR_HEADERS.length;col++) criteria[col]=filter.getColumnFilterCriteria(col);
    function restore(target) { for(var col=1;col<criteria.length;col++) if(criteria[col]) target.setColumnFilterCriteria(col,criteria[col]); }
    try {
      if (filter) filter.remove();
      restore(sheet.getRange(1,1,count+1,SEMINAR_HEADERS.length).createFilter());
    } catch(error) {
      // Restore the original criteria before returning a failed write; a retry
      // repeats preparation because its completion marker is not advanced.
      if (previousRange) { var partial=sheet.getFilter(); if(partial) partial.remove(); restore(previousRange.createFilter()); }
      throw error;
    }
  }
  SpreadsheetApp.flush();
  props.setProperty(key,String(count+1));
}
function doPost(e) {
  var lock, held = false;
  try {
    var now = Date.now();
    // Select only a registered key from untrusted routing metadata, then authenticate exact bytes.
    if (!e || !e.postData || typeof e.postData.contents !== 'string' || e.postData.contents.length > 32768) throw Error('invalid_signature');
    var routeEnvelope = JSON.parse(e.postData.contents);
    var route = JSON.parse(Utilities.newBlob(Utilities.base64Decode(routeEnvelope.payload)).getDataAsString('UTF-8'));
    if (route.eventId === 'contact') return inquiryPost(e,now);
    var config = seminarConfig(route.eventId), p = seminarVerify(e, config, now);
    config = seminarConfig(p.eventId);
    if (p.action === 'readiness') {
      if (!seminarKeys(p, ['action','eventId'].concat(config.eventId === 'cupsnballs' ? ['consentVersion'] : [])) || (config.eventId === 'cupsnballs' && p.consentVersion !== config.props.getProperty('CUPSNBALLS_CONSENT_VERSION'))) return seminarJson({ok:false,error:'invalid_request'});
    } else if (p.action !== 'submit' || !seminarKeys(p, ['action','eventId','idempotencyKey','fingerprint','receivedAt','eligible','rejection','record','ipHash','contactHash','capacity','paymentDueHours']) || !SEMINAR_UUID.test(p.idempotencyKey) || !SEMINAR_HASH.test(p.fingerprint) || !SEMINAR_HASH.test(p.ipHash) || !SEMINAR_HASH.test(p.contactHash) || p.capacity !== config.capacity || p.paymentDueHours !== 24 || typeof p.eligible !== 'boolean') return seminarJson({ok:false,error:'invalid_request'});
    lock = LockService.getScriptLock(); held = lock.tryLock(10000);
    if (!held) return seminarJson({ok:false,error:'storage_unavailable'});
    var sheet = SpreadsheetApp.openById(config.id).getSheetByName(config.tab);
    if (!sheet) throw Error('invalid_sheet');
    var rows = seminarRead(sheet, config);
    if (p.action === 'readiness') return seminarJson({ok:true,ready:true});
    var existing = rows.find(function (row) { return seminarCell(row, '재시도 키') === p.idempotencyKey; });
    if (existing) return seminarJson(seminarCell(existing, '요청 지문') === p.fingerprint ? {ok:true,receipt:seminarReceipt(existing)} : {ok:false,error:'idempotency_conflict'});
    var limited = seminarRate(config.props,p.ipHash,now); if (limited) return seminarJson(limited);
    if (!p.eligible) {
      var allowed = ['signup_closed','price_changed','option_unavailable','consent_changed'];
      if (!p.rejection || !allowed.includes(p.rejection.error)) return seminarJson({ok:false,error:'invalid_request'});
      return seminarJson(Object.assign({ok:false},p.rejection));
    }
    if (!seminarRecordValid(p.record,p.receivedAt,true,config.eventId) || Math.abs(now-Date.parse(p.receivedAt)) > 300000) return seminarJson({ok:false,error:'invalid_request'});
    if (Date.parse(p.receivedAt) < Date.parse(config.eventId === 'cupsnballs' ? '2026-11-27T18:00:00+09:00' : '2026-12-15T10:00:00+09:00') || Date.parse(p.receivedAt) >= Date.parse(config.eventId === 'cupsnballs' ? '2026-12-19T00:00:00+09:00' : '2027-01-11T00:00:00+09:00')) return seminarJson({ok:false,error:'signup_closed'});
    var recent = rows.filter(function (row) { var r = JSON.parse(seminarCell(row, '서버 기록')); return r.contactType === p.record.contactType && r.contact === p.record.contact && Date.parse(seminarCell(row, '접수 시각 원본')) > now - 3600000; });
    if (recent.length >= 3) return seminarJson({ok:false,error:'rate_limited',retryAfter:Math.max(1,Math.ceil((Math.min.apply(null,recent.map(function (row) {return Date.parse(seminarCell(row, '접수 시각 원본'));})) + 3600000-now)/1000))});
    if (config.capacity !== null && rows.length >= config.capacity) return seminarJson({ok:false,error:'sold_out'});
    if (config.eventId === 'cupsnballs') seminarExpandCups(sheet,rows.length+2);
    var row = seminarRow(Utilities.getUuid(),p);
    var range = sheet.getRange(rows.length+2,1,1,SEMINAR_HEADERS.length);
    range.setNumberFormat('@'); range.setValues([row]);
    sheet.getRange(rows.length+2,seminarColumn('입금할 금액')+1).setNumberFormat('0');
    sheet.getRange(rows.length+2,seminarColumn('입금')+1).setNumberFormat('0');
    SpreadsheetApp.flush();
    return seminarJson({ok:true,receipt:seminarReceipt(row)});
  } catch (error) {
    return seminarJson({ok:false,error:error.message === 'invalid_signature' || error.message === 'invalid_event' ? error.message : 'storage_unavailable'});
  } finally { if (held) lock.releaseLock(); }
}
function doGet() { return seminarJson({ok:false,error:'method_not_allowed'}); }
function setupSeminarSheet(eventId) {
  var config = seminarConfig(eventId), lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw Error('lock_unavailable');
  try {
    var file = SpreadsheetApp.openById(config.id), sheet = file.getSheetByName(config.tab);
    if (sheet && sheet.getLastRow() > 1) throw Error('existing_rows_preserved');
    if (sheet && sheet.getLastRow() === 1) {
      var header = JSON.stringify(sheet.getDataRange().getValues()[0]);
      if (header !== JSON.stringify(SEMINAR_HEADERS) && header !== JSON.stringify(SEMINAR_LEGACY_HEADERS)) throw Error('existing_header_preserved');
    }
    if (!sheet) sheet = file.insertSheet(config.tab);
    if (sheet.getMaxColumns() < SEMINAR_HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), SEMINAR_HEADERS.length-sheet.getMaxColumns());
    if (sheet.getMaxRows() < 61) sheet.insertRowsAfter(sheet.getMaxRows(),61-sheet.getMaxRows());
    sheet.getRange(2,21,60,1).clearDataValidations().clearFormat();
    sheet.getRange(1,1,1,SEMINAR_HEADERS.length).setValues([SEMINAR_HEADERS]);
    sheet.getRange(1,1,61,SEMINAR_HEADERS.length).setNumberFormat('@');
    sheet.getRange(2,seminarColumn('입금할 금액')+1,60,1).setNumberFormat('0');
    var paymentColumn = seminarColumn('입금'), letter = seminarLetter(paymentColumn);
    var payment = sheet.getRange(2,paymentColumn+1,60,1);
    payment.setNumberFormat('0').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied('=AND(ISNUMBER('+letter+'2),OR('+letter+'2=0,'+letter+'2=1))').setAllowInvalid(false).build());
    var paidRule = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$'+letter+'2=1')
      .setBackground('#d9ead3').setRanges([sheet.getRange(2,1,60,SEMINAR_HEADERS.length)]).build();
    sheet.setConditionalFormatRules([paidRule]);
    sheet.setFrozenRows(1);
    if (sheet.getFilter()) sheet.getFilter().remove();
    sheet.getRange(1,1,61,SEMINAR_HEADERS.length).createFilter();
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    var protection = protections.length ? protections[0] : sheet.protect();
    protections.slice(1).forEach(function (extra) { extra.remove(); });
    protection.setDescription('입금 상태 외 원본 보호');
    protection.setUnprotectedRanges([payment]);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
    if (config.eventId === 'cupsnballs') {config.props.deleteProperty('cups_sheet_prepared_rows');seminarExpandCups(sheet,sheet.getMaxRows());}
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function setupCupsnballsSheet() { return setupSeminarSheet('cupsnballs'); }


var INQUIRY_HEADERS=['문의 번호','접수 시각','회원 구분','답장 연락처','문의 내용','재시도 키','요청 지문','알림 상태','답변 완료일'];
function inquiryConfig() {
  var props=PropertiesService.getScriptProperties(),id=props.getProperty('CONTACT_SHEET_ID'),secret=props.getProperty('CONTACT_SHEETS_SIGNING_SECRET');
  if (!id || !secret || Utilities.newBlob(secret).getBytes().length<32) throw Error('not_configured');
  return {props:props,id:id,secret:secret,eventId:'contact'};
}
function inquiryLimiterReady(props,now) {
  var all=props.getProperties();
  Object.keys(all).forEach(function(key){
    if(key.indexOf('inquiry_rate_')!==0)return;
    var entry=JSON.parse(all[key]);
    if(!entry || !Number.isFinite(entry.until) || !Number.isFinite(entry.count))throw Error('invalid_limiter');
    if(entry.until<=now){props.deleteProperty(key);delete all[key];}
  });
  // Reserve room for one new rate entry before advertising readiness.
  return JSON.stringify(all).length+200<=400000;
}
function inquiryPost(e,now) {
  var lock,held=false;
  try {
    var config=inquiryConfig(),p=seminarVerify(e,config,now);
    if (!['inquiry_readiness','inquiry_submit','inquiry_alert','inquiry_status'].includes(p.action)) throw Error('invalid_request');
    lock=LockService.getScriptLock();held=lock.tryLock(10000);if(!held) throw Error('lock_unavailable');
    var sheet=SpreadsheetApp.openById(config.id).getSheetByName('문의');if(!sheet) throw Error('invalid_sheet');
    var values=sheet.getDataRange().getValues();if(JSON.stringify(values[0])!==JSON.stringify(INQUIRY_HEADERS)) throw Error('invalid_sheet');
    if(p.action==='inquiry_readiness') return seminarJson({ok:true,ready:inquiryLimiterReady(config.props,now)});
    if(!SEMINAR_UUID.test(p.idempotencyKey)||!SEMINAR_HASH.test(p.fingerprint)) throw Error('invalid_request');
    var rows=values.slice(1),existingIndex=-1;
    rows.forEach(function(row,index){if(row.length!==INQUIRY_HEADERS.length || !SEMINAR_UUID.test(row[0]) || !SEMINAR_UUID.test(row[5]) || !SEMINAR_HASH.test(row[6])) throw Error('invalid_sheet');if(row[5]===p.idempotencyKey){if(existingIndex!==-1)throw Error('invalid_sheet');existingIndex=index;}});
    if(existingIndex!==-1){
      var existing=rows[existingIndex];
      if(existing[6]!==p.fingerprint)return seminarJson({ok:false,error:'idempotency_conflict'});
      if(p.action==='inquiry_alert') {if(typeof p.alerted!=='boolean')throw Error('invalid_request');if(existing[7]!=='확인됨')sheet.getRange(existingIndex+2,8).setValue(p.alerted?'확인됨':'미확인');SpreadsheetApp.flush();}
      return seminarJson({ok:true,id:existing[0],notify:false,receivedAt:existing[1]});
    }
    if(p.action==='inquiry_status')return seminarJson({ok:true,state:'unknown'});
    if(p.action!=='inquiry_submit')throw Error('invalid_request');
    var r=p.record;
    if(!seminarKeys(r,['message','reply','author']) || typeof r.message!=='string' || !r.message.trim() || r.message.length>1400 || typeof r.reply!=='string'||r.reply.length>150 || !seminarString(r.author,200) || !SEMINAR_HASH.test(p.ipHash) || !Number.isFinite(Date.parse(p.receivedAt)) || Math.abs(now-Date.parse(p.receivedAt))>300000)throw Error('invalid_request');
    if(!inquiryLimiterReady(config.props,now))throw Error('limiter_full');
    var rateKey='inquiry_rate_'+p.ipHash,rate=JSON.parse(config.props.getProperty(rateKey)||'null');
    if(!rate||rate.until<=now)rate={count:0,until:now+60000};
    if(rate.count>=3)return seminarJson({ok:false,error:'rate_limited'});
    rate.count++;config.props.setProperty(rateKey,JSON.stringify(rate));
    var id=Utilities.getUuid(),row=[id,p.receivedAt,seminarText(r.author),seminarText(r.reply),seminarText(r.message),p.idempotencyKey,p.fingerprint,'미확인',''];
    if(sheet.getMaxRows()<rows.length+2){sheet.insertRowsAfter(sheet.getMaxRows(),100);sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p){p.setUnprotectedRanges([sheet.getRange(2,9,sheet.getMaxRows()-1,1)]);});}
    sheet.getRange(rows.length+2,1,1,INQUIRY_HEADERS.length).setNumberFormat('@').setValues([row]);SpreadsheetApp.flush();
    // Claim the one alert with the durable write. A replay cannot duplicate it.
    return seminarJson({ok:true,id:id,notify:true,receivedAt:p.receivedAt});
  }catch(error){return seminarJson({ok:false,error:'storage_unavailable'});}finally{if(held)lock.releaseLock();}
}
function setupInquirySheet(){
  var config=inquiryConfig(),lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('lock_unavailable');
  try{var file=SpreadsheetApp.openById(config.id),sheet=file.getSheetByName('문의');
    if(sheet&&sheet.getLastRow()>1)throw Error('existing_rows_preserved');
    if(sheet&&sheet.getLastRow()===1&&JSON.stringify(sheet.getDataRange().getValues()[0])!==JSON.stringify(INQUIRY_HEADERS))throw Error('existing_header_preserved');
    if(!sheet)sheet=file.insertSheet('문의');sheet.getRange(1,1,1,INQUIRY_HEADERS.length).setValues([INQUIRY_HEADERS]);sheet.setFrozenRows(1);
    var protections=sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET),protection=protections.length?protections[0]:sheet.protect();protection.setDescription('문의 원본 보호');protection.setUnprotectedRanges([sheet.getRange(2,9,sheet.getMaxRows()-1,1)]);protection.removeEditors(protection.getEditors());if(protection.canDomainEdit())protection.setDomainEdit(false);SpreadsheetApp.flush();
  }finally{lock.releaseLock();}
}
