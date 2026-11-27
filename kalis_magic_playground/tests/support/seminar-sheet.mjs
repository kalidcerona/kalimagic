import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
export function createLocalSheet({ now = Date.parse('2026-12-15T01:00:00Z'), secret = 'local-test-signing-secret-32-characters', eventId = 'daebeongae', setup = true, properties = {} } = {}) {
  const state = { now, rows: [], opens: 0, flushes: 0, locked: false, lockUnavailable: false, failFlush: false, failProperties: false, protections: [], formats: [], validation: null, maxColumns: 21, maxRows: 60, cleared: [] };
  const props = { SEMINAR_SHEET_ID: 'local-test-sheet', SEMINAR_EVENT_ID: eventId, SEMINAR_SHEETS_SIGNING_SECRET: secret, ...properties };
  let filter = null;
  function range(row, col, height = 1, width = 1) {
    return { row,col,height,width, getNumRows:()=>height, setValue(value){return this.setValues([[value]]);}, setNumberFormat(format) { state.formats.push({row,col,height,width,format}); return this; }, setValues(values) {
      for (let r = 0; r < height; r++) { state.rows[row-1+r] ||= []; for (let c = 0; c < width; c++) state.rows[row-1+r][col-1+c] = values[r][c]; } return this;
    }, clearDataValidations() {state.cleared.push({row,col,height,width,kind:'validation'});return this;}, clearFormat() {state.cleared.push({row,col,height,width,kind:'format'});return this;}, setDataValidation(rule) { state.validation = {...rule,row,col,height,width}; return this; }, createFilter() { if(state.failFilter){state.failFilter=false;throw Error('filter_failure');} filter = {row,col,height,width,criteria:{},getRange:()=>range(row,col,height,width),getColumnFilterCriteria(col){return this.criteria[col] || null;},setColumnFilterCriteria(col,value){this.criteria[col]=value;return this;},remove(){filter=null;}}; state.filter=filter; return filter; } };
  }
  const sheet = { getMaxColumns:()=>state.maxColumns, insertColumnsAfter(index,count){state.maxColumns+=count;}, getMaxRows:()=>state.maxRows, insertRowsAfter(index,count){state.maxRows+=count;}, getProtections:()=>state.protections, setConditionalFormatRules(rules) { state.rules=rules; }, getDataRange: () => ({ getValues: () => { if (!state.locked) throw Error('read_without_lock'); return structuredClone(state.rows); } }), getLastRow: () => state.rows.length, getRange: range, setFrozenRows(value) { state.frozen = value; }, getFilter: () => filter, protect() {
    const p = { setDescription(value) {this.description=value; return this; }, setUnprotectedRanges(ranges) { this.ranges=ranges; return this; }, getEditors: () => [], removeEditors() {}, canDomainEdit: () => false, remove(){state.protections=state.protections.filter(item=>item!==this);} }; state.protections.push(p);return p;
  } };
  let exists = false;
  class LocalDate extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  const context = vm.createContext({ Date: LocalDate, console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] ?? null, getProperties: () => ({...props}), setProperty(key,value) { if (state.failProperties) throw Error('quota'); props[key] = value; }, deleteProperty(key) { if (state.failProperties) throw Error('quota'); delete props[key]; } }) },
    Utilities: { newBlob(value) { const buffer = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value); return { getBytes: () => [...buffer], getDataAsString: () => buffer.toString('utf8') }; }, computeHmacSha256Signature: (value,key) => [...createHmac('sha256',key).update(value).digest()], base64Decode: value => [...Buffer.from(value,'base64')], getUuid: randomUUID, formatDate(value) { return new Date(value.getTime()+9*3600000).toISOString().slice(0,19).replace('T',' '); } },
    ContentService: { MimeType: {JSON:'application/json'}, createTextOutput: value => ({value,setMimeType() {return this;} }) },
    LockService: { getScriptLock: () => ({ tryLock() { if (state.lockUnavailable || state.locked) return false; state.locked = true; return true; }, releaseLock() {state.locked=false;} }) },
    SpreadsheetApp: { ProtectionType:{SHEET:'SHEET'}, openById(id) { if (id !== 'local-test-sheet') throw Error('nonlocal_sheet'); state.opens++; return {getSheetByName: name => exists && name === state.tab ? sheet : null, insertSheet(name) {exists=true; state.tab=name; return sheet;} }; }, flush() {state.flushes++; if (state.failFlush) {state.failFlush=false; throw Error('lost_flush_response');} }, newConditionalFormatRule() { return { whenFormulaSatisfied(formula){this.formula=formula;return this;},setBackground(color){this.color=color;return this;},setRanges(ranges){this.ranges=ranges;return this;},build(){return this;} }; }, newDataValidation() { return { requireFormulaSatisfied(formula) {this.formula=formula;return this;}, setAllowInvalid(value) {this.allowInvalid=value;return this;}, build() {return {...this};} }; } }
  });
  vm.runInContext(readFileSync(new URL('../../scripts/seminar-signup/Code.gs',import.meta.url),'utf8'),context);
  if (setup) context.setupSeminarSheet();
  return { state, props, context, secret,
    sign(payload, timestamp=state.now) { const encoded=Buffer.from(JSON.stringify(payload)).toString('base64'); return {version:1,timestamp,payload:encoded,signature:createHmac('sha256',secret).update(`1\n${timestamp}\n${encoded}`).digest('hex')}; },
    send(envelope) { return JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).value); },
    submit(payload) { return this.send(this.sign(payload)); },
    ready() { return this.submit({action:'readiness',eventId}); }
  };
}
export function localSubmission(index=1, now=Date.parse('2026-12-15T01:00:00Z'), overrides={}) {
  const hash = index.toString(16).padStart(64,'0');
  return {action:'submit',eventId:'daebeongae',idempotencyKey:randomUUID(),fingerprint:hash,receivedAt:new Date(now).toISOString(),eligible:true,rejection:null,record:{name:'테스트 참가자',contactType:'phone',contact:`010${String(index).padStart(8,'0')}`,ageConfirmed:true,birthDate:'1990-01-02',gender:'male',discovery:'instagram',discoveryOther:'',reason:'content',reasonOther:'',consent:true,photoConsent:true,photoConsentVersion:'2026-11-30-v2',photoConsentedAt:new Date(now).toISOString(),payerName:null,items:[{id:'lecture',label:'렉쳐',quantity:1,unitPrice:20000}],total:20000,version:'2027-01-v1',tier:'super',consentVersion:'2026-11-30-v2',consentedAt:new Date(now).toISOString(),paymentDueAt:new Date(now+86400000).toISOString()},ipHash:hash,contactHash:hash,capacity:60,paymentDueHours:24,...overrides};
}
