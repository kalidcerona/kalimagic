/* Verbatim setup excerpts from 79eb7585a5f00263dbe3d58a17fc9740166bb7a7:kalis_magic_playground/scripts/seminar-signup/Code.gs. */

var SEMINAR_LEGACY_HEADERS = ['접수번호','접수 시각 (KST)','신청자명','입금자명','연락처 종류','연락처','선택 항목','입금할 금액','입금 기한 (KST)','행사 ID','항목 스냅샷','가격 버전','가격 구간','동의 버전','동의 시각','재시도 키','요청 지문','접수 시각 원본','입금 기한 원본','서버 기록','입금'];
var SEMINAR_HEADERS = SEMINAR_LEGACY_HEADERS.slice(0,-1).concat(['생년월일','성별','유입 경로','유입 경로 기타','신청 이유','신청 이유 기타','촬영 안내 버전','촬영 안내 확인 시각','입금']);
function seminarColumn(name) { return SEMINAR_HEADERS.indexOf(name); }
function seminarLetter(index) { var result = ''; for (index++; index > 0; index = Math.floor((index-1)/26)) result = String.fromCharCode(65+(index-1)%26)+result; return result; }
var SEMINAR_BASE_HEADERS = SEMINAR_HEADERS.slice();
function seminarSelectHeaders(eventId) { SEMINAR_HEADERS = eventId === 'cupsnballs' ? SEMINAR_BASE_HEADERS.slice(0,-1).concat(['만 14세 이상 확인','홍보용 사진 활용 동의','입금']) : SEMINAR_BASE_HEADERS.slice(); }
var SEMINAR_TAB = '신청 명단';
function seminarConfig(requestedEvent) {
  var props = PropertiesService.getScriptProperties();
  var events = (props.getProperty('SEMINAR_EVENT_ID') || '').split(',').map(function (entry) { return entry.trim(); });
  if (requestedEvent && !events.includes(requestedEvent)) throw Error('invalid_event');
  if (events.some(function (entry) { return !['daebeongae','cupsnballs'].includes(entry); })) throw Error('not_configured');
  if (!requestedEvent && events.length !== 1) throw Error('invalid_event');
  var eventId = requestedEvent || events[0];
  var id = props.getProperty(eventId === 'cupsnballs' ? 'CUPSNBALLS_SHEET_ID' : 'SEMINAR_SHEET_ID');
  var secret = props.getProperty(eventId === 'cupsnballs' ? 'CUPSNBALLS_SHEETS_SIGNING_SECRET' : 'SEMINAR_SHEETS_SIGNING_SECRET');
  if (!id || !secret || Utilities.newBlob(secret).getBytes().length < 32) throw Error('not_configured');
  if (eventId === 'cupsnballs' && !/^2026-11-27-[0-9a-f]{12}$/.test(props.getProperty('CUPSNBALLS_CONSENT_VERSION') || '')) throw Error('not_configured');
  seminarSelectHeaders(eventId);
  return { props: props, id: id, eventId: eventId, secret: secret, tab:eventId === 'daebeongae' ? SEMINAR_TAB : '컵앤볼 신청 명단', capacity:eventId === 'daebeongae' ? 60 : null };
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
