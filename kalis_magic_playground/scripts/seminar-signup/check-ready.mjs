// Run from a private server environment before enabling sales.
import {getEvent} from '../../netlify/functions/_lib/seminar-events.mjs';
import {createSheetsStore} from '../../netlify/functions/_lib/seminar-sheets.mjs';

try {
  const event = getEvent(process.argv[2]);
  if (!event || process.argv.length > 3) {
    console.error('지원하지 않는 행사입니다. daebeongae 또는 cupsnballs를 지정하세요.');
    process.exitCode = 1;
  } else {
    const result = await createSheetsStore(event).submit({action: 'readiness', eventId: event.id, ...(event.id === 'cupsnballs' ? {consentVersion:event.consentVersion} : {})});
    if (result?.ok !== true || result.ready !== true) throw new Error();
    console.log('명단 접근 및 제목 행 확인 완료');
  }
} catch {
  console.error('명단 연결 확인 실패');
  process.exitCode = 1;
}
