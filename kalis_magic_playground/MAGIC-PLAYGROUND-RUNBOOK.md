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

1. Netlify functions를 이전 deploy로 rollback한다.
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
