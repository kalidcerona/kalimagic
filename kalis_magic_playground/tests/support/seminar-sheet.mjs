import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
export function createLocalSheet({ now = Date.parse('2026-12-15T01:00:00Z'), secret = 'local-test-signing-secret-32-characters', eventId = 'daebeongae', setup = true, properties = {} } = {}) {
  const tabState = () => ({ rows: [], protections: [], formats: [], validation: null, maxColumns: 21, maxRows: 60, cleared: [] });
  const state = { ...tabState(), now, opens: 0, flushes: 0, locked: false, lockUnavailable: false, failFlush: false, failProperties: false };
  const tabs = new Map();
  const props = { SEMINAR_SHEET_ID: 'local-test-sheet', SEMINAR_EVENT_ID: eventId, SEMINAR_SHEETS_SIGNING_SECRET: secret, ...properties };
  function makeSheet(tab) {
    let filter = null;
    function range(row, col, height = 1, width = 1) {
      return { row,col,height,width, getNumRows:()=>height, getNumColumns:()=>width, getRow:()=>row, getColumn:()=>col, setValue(value){return this.setValues([[value]]);}, setNumberFormat(format) { tab.formats.push({row,col,height,width,format}); return this; }, setValues(values) {
        for (let r = 0; r < height; r++) { tab.rows[row-1+r] ||= []; for (let c = 0; c < width; c++) tab.rows[row-1+r][col-1+c] = values[r][c]; } return this;
      }, clearDataValidations() {tab.cleared.push({row,col,height,width,kind:'validation'});return this;}, clearFormat() {tab.cleared.push({row,col,height,width,kind:'format'});return this;}, setDataValidation(rule) { tab.validation = {...rule,row,col,height,width}; return this; }, createFilter() { if(tab.failFilter){tab.failFilter=false;throw Error('filter_failure');} filter = {row,col,height,width,criteria:{},getRange(){return range(this.row,this.col,this.height,this.width);},getColumnFilterCriteria(col){return this.criteria[col] || null;},setColumnFilterCriteria(col,value){this.criteria[col]=value;return this;},remove(){filter=null;}}; tab.filter=filter; return filter; } };
    }
    const sheet = { getMaxColumns:()=>tab.maxColumns, insertColumnsAfter(index,count){tab.maxColumns+=count;}, getMaxRows:()=>tab.maxRows, insertRowsAfter(index,count){tab.maxRows+=count;},
      deleteRow(row) {
        tab.rows.splice(row-1,1);
        tab.maxRows--;
        if (filter && row < filter.row) filter.row--;
        else if (filter && row < filter.row + filter.height) filter.height--;
      },
      getProtections:()=>tab.protections, setConditionalFormatRules(rules) { tab.rules=rules; }, getDataRange: () => ({ getValues: () => { if (!state.locked) throw Error('read_without_lock'); return structuredClone(tab.rows); } }), getLastRow: () => tab.rows.length, getRange: range, setFrozenRows(value) { tab.frozen = value; }, getFilter: () => filter, protect() {
      const p = { setDescription(value) {this.description=value; return this; }, setUnprotectedRanges(ranges) { this.ranges=ranges; return this; }, getEditors: () => [], removeEditors() {}, canDomainEdit: () => false, remove(){tab.protections=tab.protections.filter(item=>item!==this);} }; tab.protections.push(p);return p;
    } };
    return sheet;
  }
  class LocalDate extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } }
  const context = vm.createContext({ Date: LocalDate, console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props[key] ?? null, getProperties: () => ({...props}), setProperty(key,value) { if (state.failProperties) throw Error('quota'); props[key] = value; }, deleteProperty(key) { if (state.failProperties) throw Error('quota'); delete props[key]; } }) },
    Utilities: { newBlob(value) { const buffer = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value); return { getBytes: () => [...buffer], getDataAsString: () => buffer.toString('utf8') }; }, computeHmacSha256Signature: (value,key) => [...createHmac('sha256',key).update(value).digest()], base64Decode: value => [...Buffer.from(value,'base64')], getUuid: randomUUID, formatDate(value, timeZone, format) {
      if (timeZone !== 'Asia/Seoul') throw Error('unsupported_time_zone');
      const kst = new Date(value.getTime()+9*3600000).toISOString();
      if (format === 'yyyyMMddHHmm') return kst.slice(0,16).replace(/[^0-9]/g,'');
      if (format === 'yyyy-MM-dd HH:mm:ss') return kst.slice(0,19).replace('T',' ');
      throw Error('unsupported_date_format');
    } },
    ContentService: { MimeType: {JSON:'application/json'}, createTextOutput: value => ({value,setMimeType() {return this;} }) },
    LockService: { getScriptLock: () => ({ tryLock() { if (state.lockUnavailable || state.locked) return false; state.locked = true; return true; }, releaseLock() {state.locked=false;} }) },
    SpreadsheetApp: { ProtectionType:{SHEET:'SHEET'}, BooleanCriteria:{CUSTOM_FORMULA:'CUSTOM_FORMULA'}, openById(id) { state.opens++;
      if (id !== 'local-test-sheet') throw Error('nonlocal_sheet');
      return {getSheetByName: name => tabs.get(name)?.sheet || null, insertSheet(name) {
        if (tabs.has(name)) throw Error('duplicate_sheet');
        const tab = tabs.size ? tabState() : state;
        tab.tab = name;
        const sheet = makeSheet(tab);
        tabs.set(name, {state:tab, sheet});
        return sheet;
      }};
    }, flush() {state.flushes++; if (state.failFlush) {state.failFlush=false; throw Error('lost_flush_response');} }, newConditionalFormatRule() { return { whenFormulaSatisfied(formula){this.formula=formula;return this;},setBackground(color){this.color=color;return this;},setRanges(ranges){this.ranges=ranges;return this;},build(){return this;} }; }, newDataValidation() { return { requireFormulaSatisfied(formula) {this.formula=formula;return this;}, setAllowInvalid(value) {this.allowInvalid=value;return this;}, build() {return {...this};} }; } }
  });
  vm.runInContext(readFileSync(new URL('../../scripts/seminar-signup/Code.gs',import.meta.url),'utf8'),context);
  if (setup) context.setupSeminarSheet();
  return { state, tabs, props, context, secret,
    sign(payload, timestamp=state.now, signingSecret=secret) { const encoded=Buffer.from(JSON.stringify(payload)).toString('base64'); return {version:1,timestamp,payload:encoded,signature:createHmac('sha256',signingSecret).update(`1\n${timestamp}\n${encoded}`).digest('hex')}; },
    send(envelope) { return JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).value); },
    submit(payload) { return this.send(this.sign(payload)); },
    ready() { return this.submit({action:'readiness',eventId}); }
  };
}
export function localSubmission(index=1, now=Date.parse('2026-12-15T01:00:00Z'), overrides={}) {
  const hash = index.toString(16).padStart(64,'0');
  return {action:'submit',eventId:'daebeongae',idempotencyKey:randomUUID(),fingerprint:hash,receivedAt:new Date(now).toISOString(),eligible:true,rejection:null,record:{name:'테스트 참가자',contactType:'phone',contact:`010${String(index).padStart(8,'0')}`,ageConfirmed:true,birthDate:'1990-01-02',gender:'male',discovery:'instagram',discoveryOther:'',reason:'content',reasonOther:'',consent:true,photoConsent:true,photoConsentVersion:'2026-11-30-v2',photoConsentedAt:new Date(now).toISOString(),payerName:null,items:[{id:'lecture',label:'렉쳐',quantity:1,unitPrice:20000}],total:20000,version:'2027-01-v1',tier:'super',consentVersion:'2026-11-30-v2',consentedAt:new Date(now).toISOString(),paymentDueAt:new Date(now+86400000).toISOString()},ipHash:hash,contactHash:hash,capacity:60,paymentDueHours:24,...overrides};
}
