import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalSheet,localSubmission} from '../support/seminar-sheet.mjs';

// Model only the Sheets v4 requests this migration uses. Inputs and resulting visible cells
// are independent of the Apps Script writer. A rejected batch never commits its working copy.
function migrationFixture(eventId) {
  const cups=eventId==='cupsnballs', version=cups?'2026-11-27-123456789abc':'2026-11-30-v3';
  const s=createLocalSheet({eventId,properties:{CUPSNBALLS_SHEET_ID:'local-test-sheet',
    CUPSNBALLS_SHEETS_SIGNING_SECRET:'local-test-signing-secret-32-characters',CUPSNBALLS_CONSENT_VERSION:version,
    CUPSNBALLS_LINKAGE_CONSENT_VERSION:version}});
  const {state,context}=s, {sheet}=s.tabs.get(state.tab);
  const oldWidth=cups?32:29, oldPayment=oldWidth-1, id=3;
  state.rows[0].splice(oldPayment,2);state.maxColumns=oldWidth;
  let letter=context.seminarLetter(oldPayment);
  const grid=(row,col,endCol)=>({sheetId:id,startRowIndex:row,endRowIndex:61,startColumnIndex:col,endColumnIndex:endCol});
  const cond=formula=>({type:'CUSTOM_FORMULA',values:[{userEnteredValue:formula}]});
  const custom={condition:cond('=$'+letter+'2=1')};
  const meta={properties:{sheetId:id},basicFilter:{range:grid(0,0,oldWidth),
    criteria:{3:structuredClone(custom),[oldPayment]:{hiddenValues:['0']}},
    sortSpecs:[{dimensionIndex:oldPayment,sortOrder:'ASCENDING'}]},
    filterViews:[{filterViewId:7,title:'입금',namedRangeId:'roster',filterSpecs:[{columnIndex:3,filterCriteria:structuredClone(custom)}]}],
    conditionalFormats:[{ranges:[grid(1,0,oldWidth)],booleanRule:{condition:cond('=$'+letter+'2=1'),format:{backgroundColor:{green:1}}}}],
    protectedRanges:[{protectedRangeId:8,range:{sheetId:id},unprotectedRanges:[grid(1,oldPayment,oldWidth)]}]};
  const named={namedRangeId:'roster',range:grid(0,0,oldWidth)};
  sheet.getSheetId=()=>id;
  const range=sheet.getRange, data=sheet.getDataRange;
  sheet.getRange=(...args)=>Object.assign(range(...args),{
    getDataValidations:()=>Array.from({length:60},(_,i)=>[{getAllowInvalid:()=>false,getCriteriaType:()=>'CUSTOM_FORMULA',
      getCriteriaValues:()=>['=AND(ISNUMBER('+letter+(i+2)+'),OR('+letter+(i+2)+'=0,'+letter+(i+2)+'=1))']}]),
    getNumberFormats:()=>Array.from({length:60},()=>['0'])});
  sheet.getDataRange=()=>({...data(),getFormulas:()=>state.rows.map(row=>row.map(()=>''))});
  context.SpreadsheetApp.DataValidationCriteria={CUSTOM_FORMULA:'CUSTOM_FORMULA'};
  const service={reject:false,loseResponse:false,calls:0};
  context.Sheets={Spreadsheets:{
    get:()=>structuredClone({sheets:[meta],namedRanges:[named]}),
    batchUpdate:({requests})=>{
      service.calls++;assert.ok(state.locked);
      const rows=structuredClone(state.rows), next=structuredClone(meta), nextName=structuredClone(named);
      let width=state.maxColumns;
      for (const req of requests) {
        if(req.appendDimension){width+=req.appendDimension.length;continue;}
        if(req.insertDimension){
          const r=req.insertDimension.range;assert.ok(r.endIndex<=width);
          for(const row of rows)row.splice(r.startIndex,0,'','');
          width+=2;continue;
        }
        if(req.deleteDimension){const r=req.deleteDimension.range;assert.equal(r.endIndex,width);width=r.startIndex;continue;}
        if(req.setBasicFilter){next.basicFilter=req.setBasicFilter.filter;continue;}
        if(req.updateFilterView){next.filterViews[0]=req.updateFilterView.filter;continue;}
        if(req.updateNamedRange){nextName.range=req.updateNamedRange.namedRange.range;continue;}
        if(req.updateConditionalFormatRule){next.conditionalFormats[0]=req.updateConditionalFormatRule.rule;continue;}
        if(req.updateProtectedRange){next.protectedRanges[0].unprotectedRanges=req.updateProtectedRange.protectedRange.unprotectedRanges;continue;}
        if(req.setDataValidation){
          const column=context.seminarLetter(oldPayment+2);
          assert.equal(req.setDataValidation.rule.condition.values[0].userEnteredValue,'=AND(ISNUMBER('+column+'2),OR('+column+'2=0,'+column+'2=1))');continue;
        }
        if(req.repeatCell){assert.equal(req.repeatCell.range.endColumnIndex,oldPayment+2);continue;}
        if(req.updateCells){req.updateCells.rows.forEach((row,r)=>row.values.forEach((cell,c)=>{rows[r][oldPayment+c]=cell.userEnteredValue.stringValue;}));continue;}
        assert.fail('unexpected request');
      }
      if(service.reject)throw Error('rejected_batch');
      Object.assign(meta,next);Object.assign(named,nextName);state.rows=rows;state.maxColumns=width;
      letter=context.seminarLetter(width-1);
      if(service.loseResponse)throw Error('lost_response');
    }
  }};
  function request(index,mode) {
    const p=localSubmission(index,state.now,{eventId,capacity:cups?null:60});
    if(cups)Object.assign(p.record,{items:[{id:'admission',label:'테스트',quantity:1,unitPrice:20000}],promotionConsent:false,
      photoConsentVersion:version});
    p.record.consentVersion=version;
    if(mode)p.record.signupMode=mode;
    if(mode==='member')Object.assign(p.record,{memberId:p.idempotencyKey,linkageConsent:true,
      linkageConsentVersion:version,linkageConsentedAt:p.receivedAt});
    return p;
  }
  return {s,meta,named,oldPayment,request,service,migrate:()=>context.seminarMigrateMemberSheet(eventId)};
}

for(const event of ['cupsnballs','daebeongae'])test(event+' atomic migration, paid replay, named filters and rejected/lost batch recovery',()=>{
  const {s,meta,named,oldPayment,request,service,migrate}=migrationFixture(event);
  const old=request(1),guest=request(2,'guest'),member=request(3,'member');
  assert.equal(s.context.seminarMigrateCupsFilterFormula('=ISBLANK($AZ2)',s.state.tab,false,oldPayment+1,2),'=ISBLANK($BB2)');
  assert.equal(s.submit(member).error,'member_unavailable');
  assert.equal(s.submit(old).ok,true);assert.equal(s.submit(guest).ok,true);
  s.state.rows[1][oldPayment]=1;
  const receipt=s.submit(old).receipt, snapshot=structuredClone(s.state.rows);
  const criteria=meta.basicFilter.criteria[3].condition.values[0], formula=criteria.userEnteredValue;
  criteria.userEnteredValue='=OFFSET(C2,0,28)>0';
  assert.throws(migrate,/unsupported_filter_formula/);assert.equal(service.calls,0);
  criteria.userEnteredValue=formula;
  s.state.lockUnavailable=true;assert.throws(migrate,/lock_unavailable/);s.state.lockUnavailable=false;
  service.reject=true;assert.throws(migrate,/rejected_batch/);assert.deepEqual(s.state.rows,snapshot);
  service.reject=false;service.loseResponse=true;assert.throws(migrate,/lost_response/);
  assert.deepEqual(s.submit(old).receipt,receipt);
  assert.equal(s.submit(member).ok,true);
  assert.deepEqual(s.state.rows.slice(1).map(row=>row.slice(-3)),[
    ['기존 접수','',1],['비회원','',0],['회원',member.idempotencyKey,0]]);
  const payment=oldPayment+2, moved='=$'+s.context.seminarLetter(payment)+'2=1';
  assert.deepEqual(meta.basicFilter.criteria[payment].hiddenValues,['0']);
  assert.equal(meta.basicFilter.criteria[3].condition.values[0].userEnteredValue,moved);
  assert.equal(meta.basicFilter.sortSpecs[0].dimensionIndex,payment);
  assert.equal(meta.filterViews[0].filterSpecs[0].filterCriteria.condition.values[0].userEnteredValue,moved);
  assert.equal(named.range.endColumnIndex,payment+1);
  migrate();assert.equal(service.calls,2);
  const format=meta.conditionalFormats[0].booleanRule.format;
  meta.conditionalFormats[0].booleanRule.format={};assert.throws(migrate,/unsupported_roster_format/);
  meta.conditionalFormats[0].booleanRule.format=format;
  meta.protectedRanges[0].unprotectedRanges[0].startColumnIndex--;
  assert.throws(migrate,/unsupported_roster_format/);
});

test('historical 79eb758 setup upgrades from 31 through 32; rejected final batch is retryable',async()=>{
  const {readFileSync}=await import('node:fs');
  const {runInContext}=await import('node:vm');
  const {s,service}=migrationFixture('cupsnballs');
  s.state.rows=[];
  runInContext(readFileSync(new URL('../fixtures/seminar-cups-setup-79eb758.gs',import.meta.url),'utf8'),s.context);
  s.context.setupCupsnballsSheet();assert.equal(s.state.rows[0].length,31);
  runInContext(readFileSync(new URL('../../scripts/seminar-signup/Code.gs',import.meta.url),'utf8'),s.context);
  service.reject=true;
  assert.throws(()=>s.context.migrateCupsnballsMemberSheet(),/rejected_batch/);
  assert.equal(s.state.rows[0].length,32);
  assert.equal(s.submit({action:'readiness',eventId:'cupsnballs',consentVersion:s.props.CUPSNBALLS_CONSENT_VERSION}).ready,true);
  service.reject=false;s.context.migrateCupsnballsMemberSheet();
  assert.deepEqual(s.state.rows[0].slice(-4),['표시 접수번호','신청 구분','사이트 회원 식별자','입금']);
  s.context.migrateCupsnballsMemberSheet();
});
