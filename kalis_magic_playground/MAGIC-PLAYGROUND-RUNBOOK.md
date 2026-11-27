# 마술 놀이터 운영 런북

## 환경변수

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `MAGIC_PLAYGROUND_ADMIN_EMAILS`

## 출시 전 점검

- `npm test` 통과
- `npm run build` 후 `dist/`에 private docs 없음
- Supabase Google provider redirect URL 설정
- admin/kali profile role 설정
- 비공개 질문 public API 노출 수동 확인

## 사고 대응

비공개 데이터 노출 의심:

1. 접근을 차단한 뒤 이전 배포 복귀를 판단한다. 앱별 권한 JSON이 기록된 환경은 아래 «앱별 권한 배포와 구버전 복귀» 절차를 먼저 통과해야 하며, 이전 deploy로 바로 rollback하지 않는다.
2. Supabase secret key를 rotate한다.
3. `moderation_events`와 Netlify function logs를 확인한다.
4. 노출 가능성이 있는 질문자에게 공지한다.

문제 글:

1. admin inbox에서 hide 처리한다.
2. 필요하면 delete 처리한다.
3. 반복 사용자는 role/계정 제한을 검토한다.

## 프론트엔드 아키텍처 제약 (v3 기준)

### 테스트 제약 — 반드시 지킬 것
- `style.css` 마커 위(기존 영역) 수정 금지 — append-only (`/* phm v3: ... */` 섹션 이하에만 추가)
- `.playground-` 리터럴을 style.css append 블록에 직접 넣지 말 것 (테스트 grep 걸림)
- `playground.html`의 6개 script defer 태그 순서·개수 고정: auth.js → playground-api.js → playground-list.js → playground-compose.js → playground-detail.js → playground-bootstrap.js
- `addEventListener('submit'` 패턴을 playground.js에 추가하지 말 것
- `PREFIX_FILTERS` 상수와 `renderFilters()` 함수는 테스트 참조로 존재 — 삭제 금지

### 새 페이지 추가 시
- `scripts/build-public.mjs` PUBLIC_FILES 화이트리스트에 html·js 파일 명시 필수
- `tests/community/playground-v3.test.mjs`에 script 순서 assert 추가

### 보안
- auth slot 사용자 이름: `slot.innerHTML`에 직접 넣지 말고 `element.textContent = name` 패턴 사용 (XSS)
- 비로그인 write.html: `composeRoot.hidden = true` + `return` 필수 (폼 노출 차단)

### admin 판별
- `/.netlify/functions/admin-inbox?filter=all` 핑: 200 = 관리자, 403 = 일반 사용자 (백엔드 무변경)

### 백엔드(posts.mjs) 수정 시 주의
- `shapePostListRow` 반환 객체에만 필드 추가 허용 — 다른 함수 시그니처 변경 시 테스트 대량 깨짐

## 문의 함수 배포 확인

- [ ] Netlify 배포 로그의 후처리(Post-processing) 단계에서 `/api/contact` 요청 제한 규칙의 등록 결과를 확인한다. 함수 설정과 같이 도메인·IP별 60초당 3회인지 대조하고, 규칙 검증 오류가 있으면 배포 확인을 보류한다.

## 방문 통계 원본 관리

운영자는 매일 비공개 데이터베이스에서 발생 시각이 30일 지난 `events` 행을 삭제하고, 남은 행 중 가장 오래된 발생 시각을 확인합니다. 배포 전에는 과거 원본의 회원 ID 연결을 해제하고, 기존 연락 신청(leads)과 통계(events)에 공통으로 남은 세션 ID도 정리합니다. 연락 신청의 기존 세션 열은 행마다 새 난수 UUID로 바꾸고, 두 테이블에 같은 세션 ID가 남아 있는지 확인합니다. 신규 통계는 로그인 여부와 관계없이 회원 ID를 저장하지 않습니다. 이 절차는 운영자 작업이며 배포가 자동 삭제를 설정하지는 않습니다.


## 앱별 권한 배포와 구버전 복귀

`tool_access.per_app_access`가 NULL이 아니면 이 JSON이 앱별 상태·기간의 원본이다. 기존 `tool/status/lifetime` 열은 구버전의 과도한 승인을 막는 보수적인 요약이다. 한 앱만 승인됐다면 그 앱과 그 기간을 정확히 표시한다. 두 앱의 기간이 다르면 요약은 기간 권한이므로, 요약 열만으로 원본을 복원할 수 없다.

신규 배포는 `supabase/migrations/20261127_tool_access_per_app.sql`을 먼저 적용한 뒤 앱별 판독기를 배포한다. SQL은 테이블 잠금 아래 기존 열 정의와 전체 행 수·도구/상태/기간별 분포를 먼저 확인하고 기록한다. 동명 열이 예상과 다르면 DDL 전에 중단하며, 올바른 nullable JSONB 열이고 기존 JSON과 보수적 요약이 일치하면 재실행해도 행과 열을 변경하지 않는다. 앞선 앱별 배포가 이미 존재하면 JSON 형식과 요약 불일치도 검사하고, 개수와 최대 20개의 행 ID(이메일 제외)를 기록한 뒤 중단한다. 특히 이전 구현의 `all/approved` 요약에 대기 형제 앱이 섞인 경우 구버전으로 복귀하면 안 된다. JSON 판독기를 계속 유지하고 해당 ID의 JSON을 원본으로 삼는 보수적 요약 복구를 별도 검토·승인한 롤포워드 작업으로 수행한 뒤 마이그레이션을 다시 검사한다. 이 검사 실패를 우회하여 구버전 판독기를 배포하지 않는다. 운영 실행은 별도 승인된 절차로 수행하고 NOTICE와 실행 결과를 보관한다.

`5556cab`처럼 앱별 JSON을 모르는 배포로 복귀할 때:

1. 관리자 승인·회수·기간 변경뿐 아니라 로그인/앱 신청을 포함한 모든 `tool_access` 쓰기 요청을 점검 화면에서 차단한다. 이미 실행 중인 요청이 끝났는지 확인하고, 현재 DB와 배포 식별자를 백업한다. SQL의 테이블 잠금만으로 커밋 뒤 재개되는 요청까지 막을 수 없으므로 쓰기 차단은 복귀 완료까지 유지한다.
2. 현재 앱별 판독기를 유지한 상태에서 `supabase/rollback/20261127_tool_access_per_app.sql`을 오류 시 중단하는 SQL 실행기로 실행한다. 예: 승인된 DB 연결에서 `psql -X -v ON_ERROR_STOP=1 -f supabase/rollback/20261127_tool_access_per_app.sql`. 연결 문자열이나 자격증명을 문서/로그에 기록하지 않는다.
3. SQL은 전체/JSON/복귀 불가능 행 수와 최대 20개의 차단 행 ID(이메일 제외)를 먼저 출력한다. 두 앱의 상태 또는 기간이 다르거나, JSON이 객체가 아니거나, 알 수 없는 앱/필드/값이 있으면 전체 트랜잭션을 중단한다. 중단 시 **이전 서버로 전환하지 않는다.** JSON 판독을 유지하는 수정 배포를 선택하거나, 별도로 승인받은 앱별 권한 조정을 현재 관리자 화면에서 완료한 뒤 다시 검사한다. 복귀를 위해 자동으로 형제 앱을 승인·회수하거나 평생을 기간 권한으로 바꾸지 않는다.
4. 모든 JSON 행이 기존 표현으로 정확히 변환될 때만 SQL이 기존 열을 투영하고 JSON을 NULL로 비운다. 계정 행 수와 변환 행 수를 검증하며 열은 삭제하지 않는다. 이것은 두 앱 모두 같은 상태·기간인 행과 단일 앱 행에서만 성공한다. 재실행은 JSON 0행을 그대로 유지한다.
5. 성공 NOTICE와 커밋을 확인한 뒤에만 구버전 배포로 전환한다. 계정별 앱 상태·기간을 비교하고, 점검 계정만 로그인할 수 있도록 열어 두 앱의 실제 판정을 확인한 후 전체 쓰기 차단을 해제한다. 구버전은 새 앱별 쿠키 이름을 읽지 않으므로 새 쿠키만 있는 브라우저에서는 다시 로그인이 필요하다. 구버전 배포 적용이 실패하면 JSON NULL을 읽을 수 있는 현재 배포를 유지한다. 구버전에서 변경된 기존 열을 무시하는 오래된 JSON을 복원하지 않는다.

이 복귀 SQL은 운영 데이터에서 자동 실행하지 않는다. 로컬 회귀 검사는 실제 `5556cab` 판정식과 새 요약을 대조한다. SQL 실행 환경이 없으면 정적 검증만 했다는 제한을 배포 보고에 명시한다.
