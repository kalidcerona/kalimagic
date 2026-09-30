# 개인 앱 설정 확장 · 구조 감사

작성: 2026-10-01. 실제 담당: gpt-6.1-sol, medium. 앱 코드는 읽기만 수행했다. 이 문서의 `P`는 `/Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground`, `S`는 `/Users/sumpie/Desktop/AI/Projects`의 절대 경로 약칭이다. 행 번호는 조사 시점 기준이다.

현재 사용자 지시의 PC 전용 코드 삭제·나머지 개인 앱 설정 확장은 기존 `PRODUCT_DESIGN_SYSTEM.md`의 파일럿만 구현·PC 보조 입력 보존 조항보다 우선한다. 공연 화면은 TYCHE/USOTSUKI 외 현행 유지, zz12 학습 화면도 현행 유지다. 공유 앱의 고정본과 PRIVATE zz9 경계는 유지한다. 근거: `PRODUCT_DESIGN_SYSTEM.md` §4, §7, §10, 마지막 단락 및 `docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md` §1, §5.

## 활성 진입점과 독점 쓰기 경계

| 앱 | 설정 루트 / 근거 | 실제 실행 파일 | 원본 → 개인 미러 |
|---|---|---|---|
| zz1 KAIROS | `#settings #settings-card` / index.html:228-229 | index.html | S/magic-stopwatch-uni → P/zz1 |
| zz2 RELEASE | `#settings-screen .settings-inner` / index.html:339; settings-ui.js:6 | index.html | S/magic-unlock → P/zz2 |
| zz3 HITSUZEN | `#date-settings` / index.html:441 | index.html | S/magic-calculator-v2 → P/zz3 |
| zz4 너의 선택은? | `#settings .shell` / index.html:21; settings-ui.js:8 | app.js / index.html:244 | S/magic-choice → P/zz4 |
| zz5 ALETHEIA | `#settings .settings-inner` / index.html:19; settings-ui.js:9 | app.js / index.html:234 | S/magic-aletheia → P/zz5 |
| zz6 TOBIRA | `#settings .sheet` / index.html:34; settings-ui.js:10 | app.js / index.html:263 | S/magic-tobira → P/zz6 |
| zz7 USOTSUKI | `#settings-screen` / index.html:58 | detector.js / index.html:125 | S/magic-usotsuki → P/zz7 |
| zz8 아스라이 | `#settings-screen .settings-wrap` / index.html:24; settings-ui.js:12 | contacts.js / index.html:113 | S/magic-asrai → P/zz8 |
| zz9 FALSE MEMORY | `#settings-screen .settings-panel` / index.html:24 | photo.js / index.html:94 | S/magic-false-memory와 P/zz9는 수동 차이 보존 필요 |
| zz10 ALTER | `#settings .settings-panel` / index.html:64; settings-ui.js:14 | app.js / index.html:109 | S/magic-alter → P/zz10 |
| zz11 TYCHE | `#settings .settings-panel` / index.html:276; settings-ui.js:15 | app.js / index.html:298 | S/magic-spinner → P/zz11 |
| zz12 멤덱 | `#main`, 설정 탭에서 renderSettings() / app.mjs:16,24 | app.mjs / index.html:6 | S/magic-memdeck → P/zz12 |
| zz13 아로새기다 | `dialog#settings` / index.html:1 | app.mjs / index.html:1 | S/magic-qr → P/zz13 |

원본-미러 계약의 권위는 `P/scripts/build-public.mjs:155-218`이다. 프로젝트 CLAUDE.md:9의 오래된 zz2/스톱워치 설명보다 현재 코드가 우선한다. zz7/app.js·zz8/app.js는 현재 HTML이 로드하지 않고 빌드도 제외한다(:86-87). 이 파일을 현재 앱으로 보고 고치지 않는다.

zz9는 공개 목록에 없고 미러 검증에서도 제외한다(`build-public.mjs:58-75`; `tests/community/build-public.test.mjs:38`). `photo.js` 두 사본은 바이트가 다르다. 개인 zz9에는 `GUIDE_KEY`, `showGestureGuideOnce()` 등의 가이드가 추가되어 있다(`P/zz9/photo.js:7,26`). 원본 일괄 복사로 이를 지우지 않는다.

## 공유 앱 고정: 먼저 수행할 최소 변경

현재 `DISTRIBUTION_APPS`는 release/aletheia/usotsuki/tobira/tyche/kairos/kairos-classic을 `distribution-snapshots/*`에서 만든다(`build-public.mjs:222-228`). KAIROS 고정본과 키 격리는 이미 존재한다(:258-270). 반면 HITSUZEN은 `tools/calc`(:221), 아로새기다는 개인 `zz13`(:229)을 직접 복사하므로 개인 변경이 공유판에 유입된다.

1. 현재 `P/tools/calc`를 `P/distribution-snapshots/calculator`로, 현재 `P/zz13`을 `P/distribution-snapshots/qr`로 고정한다. 이미지·vendor·서비스워커·settings 파일을 빠뜨리지 않는다. 공유 고정본에는 이번 개인 디자인을 적용하지 않는다.
2. DISTRIBUTION_APPS의 해당 source 2개만 새 snapshot으로 변경한다. tool 값과 target은 유지한다. URL·권한·저장 키 재설계는 하지 않는다.
3. MIRROR_PAIRS에서 목적지가 `tools/calc/`인 11개 쌍만 제거한다(설정 2개, 일반 자산 8개, brand-logo.png 1개). `zz3`의 원본 검증은 유지한다. 기존 tools/calc 트리는 그대로 둔다.
4. tools/calc는 현재도 dist 직접 복사에서 제외되고(`build-public.mjs:309`), Netlify가 hitsuzen으로 redirect한다(`netlify.toml:159-166`). 이 legacy 트리를 개인 앱에 다시 동기화할 이유가 없다.
5. `tests/community/build-public.test.mjs:84`의 tools/calc 원본 미러 요구를 제거하고 :94,102의 배포 source 기대값을 변경한다. :219 이후 KAIROS 고정 검사의 방식으로 두 신규 고정본의 자산·HTML guard·manifest 변환을 검증한다. 기존 `settings-swipe-distance.test.mjs:5`의 legacy 검사 자체는 보존 가능하다.
6. 인프라 담당은 baseline dist/tools 전체와 작업 후 파일 목록·SHA-256을 비교한다. 빌드가 기존에 수행하는 guard/manifest 변환 외 변경이 없어야 한다. 개인 writer는 build-public/tests/snapshot을 편집하지 않는다.

## PC 전용 삭제와 보존할 키보드 기능

| 앱 | 삭제할 범위 | 유지할 범위 |
|---|---|---|
| zz1 | index.html:192-195 CSS, :243·288 PC 문구, :290 버튼, :294-322 helper와 desktopSettingsAccess 참조 | :654-659 입력 Enter/Escape, 일반 버튼 focus/labels |
| zz2 | index.html:288-290·341·421·423 PC UI, :432-460 helper, :491·722·1374 이후 연결; :861-867 전역 PIN 숫자/Backspace/Enter 리허설 | :1226 crop-handle 방향키, 폼 입력·라벨·진짜 버튼 |
| zz3 | index.html:412-414·443·505·507 PC UI, :513-541 helper, :1697·2046·2054·2084 연결 | 계산 버튼 data-key 처리와 폼 필드; key라는 이름만으로 계산 엔진을 삭제하지 않음 |
| zz4 | index.html:161 PC 안내; app.js:1170-1176 전역 리허설 키 | 터치·pointer 공연 동작, 실제 설정 폼 |
| zz5 | index.html:46·50·63 Shift+Esc/마우스 안내; app.js:2129 이후 리허설 키 블록 | canvas pointer/긁기·contextmenu 방지·리셋 제스처 |
| zz6 | index.html:205 PC 안내; app.js:1967 이후 Shift+Escape 블록 | onEdgeKey(:1781), edge radio focus(:1813), wallpaperCropHandle keydown(:1894), pointer/touch |
| zz7 | index.html:117 PC 안내; detector.js:onRehearsalKey(:741)와 등록(:765) | 홀드·짧은 취소·오디오 unlock·설정 상태 |
| zz8 | index.html:33 컴퓨터 안내; contacts.js:onKeyDown(:434)와 등록(:462) | 검색 입력·상세 이동·클릭 억제·두 손가락 제스처 |
| zz9 | photo.js:284-286 Shift+Escape | 사진 업로드·IndexedDB·비밀 탭·5초 컷·개인 가이드 |
| zz10 | app.js:428 전역 S 진입 | :429 Escape dialog 닫기; 카메라 fallback(:299)은 모바일 호환에도 필요하므로 유지 |
| zz11 | index.html:259 버튼; app.js:48-53·208-218 desktop UI, 관련 sync 호출 | 두 손가락(:188-206), busy·회차·오디오·최종 방향 |
| zz12 | app.mjs:38 전역 학습 단축키(공백/방향/R/Enter) | 입력·select·실제 버튼·학습 데이터·현재 학습 화면 |
| zz13 | index.html:1 `.desktop` setup 버튼; style.css:1 `.desktop`와 pointer:fine 규칙; app.mjs:17 setup 클릭 및 Shift+Escape 부분 | dialog 취소/닫기·submit·QR 점 편집·PNG·백업 |

두 손가락 아래 스와이프를 대체하거나 방향을 회전좌표 기준으로 바꾸지 않는다. PC 단축키 삭제를 모든 keydown 삭제로 확장하지 않는다. 모바일 외부 키보드·스크린리더·폼 Enter·radio/crop 방향키와 focus-visible은 접근성 기능이다.

넓은 화면 규칙은 PC만 뜻하지 않는다. `settings-ui.css:73`의 720px, zz5/style.css:549의 700px, zz6/style.css:726의 840px, zz8/style.css:357의 700px, zz9/style.css:615의 700px는 태블릿에도 적용된다. 삭제 기준은 fine-pointer PC 보조 UI와 명시적인 PC 코드다. zz4/style.css:975의 981px 규칙도 대형 태블릿에 걸리므로 공연 외형을 일괄 제거하지 않는다.

## 리팩터링은 설정 경계에서 최소화

10개 개인 미러의 settings-ui.js는 현재 각각 37,406바이트이며 SHA-256 앞 16자리 `27823b5444472310`으로 동일하다(zz1-8,zz10-11). 공통 코드 사본의 크기 자체만으로 새 런타임 프레임워크나 전역 설정 엔진을 만들지 않는다. 기존 앱별 container 계약을 유지하고 공통 시각 토큰·모티프를 설정 루트에 한정한다. 신규 CSS 파일을 만들면 해당 원본/미러 계약과 SW cache를 함께 갱신한다.

현 구조에서는 그룹별 설정 CSS와 필요한 HTML 래퍼만 수정하는 것이 위험이 가장 작다. 기존 공연 customization·storage·pointer 수학·타이머·camera 모듈을 리뉴얼 명목으로 옮기지 않는다. PC helper 제거 후 남는 dead reference만 같은 범위에서 정리한다. zz12 설정 탭은 동적 렌더 결과에만 클래스·토큰을 붙이고 학습 전체에 공통 테마를 적용하지 않는다. zz13은 압축된 HTML/CSS/mjs이므로 범위 지정 편집을 쓰고 전체 포맷 변경은 하지 않는다.

TYCHE 배경은 `P/zz11/style.css:24-26`에서 현재 기본 색과 background-image:none이다. 새 이미지의 소유권은 TYCHE writer 한 명에게 두고 배경층만 교체한다. 회전판 중심 수학은 `.wheel-wrap`을 기준으로 유지(:59-75). 개인 이미지 customization이 덮어쓰는 longhand 계약도 유지한다(:24). 새 자산은 원본·zz11 미러·SPINNER_FILES·SW 캐시의 동시 변경이 필요하다(`build-public.mjs:135-139`). shared spinner snapshot은 고정한다.

## 실행 가능한 독점 worker 그룹

| 그룹 | 소유 경계 | 수용 기준 |
|---|---|---|
| 인프라 | build-public.mjs, build-public.test.mjs, 신규 calculator/qr snapshot만 | 공유 dist/tools 모든 바이트 보존, 개인 미러 검증 유지 |
| A | magic-stopwatch-uni/zz1, magic-unlock/zz2, magic-calculator-v2/zz3 | 설정 공통 셸·각 signature, PC UI 삭제, 기존 폼 키 유지; tools/calc 미편집 |
| B | magic-choice/zz4, magic-aletheia/zz5, magic-tobira/zz6 | 설정만 변경, 공연·마스크·물체 타이밍 보존 |
| C | magic-usotsuki/zz7, magic-asrai/zz8, magic-false-memory 및 zz9의 차이 보존 범위 | 실제 entrypoint 수정; zz9 PRIVATE·기존 가이드 보존 |
| D | magic-alter/zz10, magic-memdeck/zz12, magic-qr/zz13 | camera/학습/QR 공연 유지; 설정·PC 전용만 수정 |
| T | magic-spinner/zz11 및 개인 배경 자산 | 배경 재제작, 설정 셸, 회전·회차·목표터치 유지 |

Sol medium이 범위·원본 근거·최종 검증을 담당하고, 사용자 지시에 따라 Grok 4.7 medium이 구현·이미지를 담당한다. 이미지 생성 도구 및 파일 접근의 실제 성공 여부는 구현 기록에서 별도로 보고한다. 이 감사는 추가 에이전트를 생성하지 않았다. 같은 그룹 원본과 미러를 서로 다른 writer에게 나누지 않는다. shared·PRIVATE·미러 기반 작업을 먼저 고정한 뒤 그룹을 진행한다.

## 실제 점검과 남은 검증

실행한 읽기 검사:

- `ls -l AGENTS.md "Projects/kalis magic/CLAUDE.md" "Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md" "Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md"`: exit 0, 모두 regular file.
- `rg -n 'mirror|zz[0-9]|ae[g]?ida|aegida|tools/calc|private' kalis_magic_playground/scripts/build-public.mjs`: exit 0, 미러/공유/PRIVATE 경계 확인.
- Python pathlib/hashlib 읽기 검사: exit 0, settings-ui.js 10개 동일 해시, `CALC_INDEX_IDENTICAL True`, `FALSE_MEMORY_IDENTICAL False`.
- `diff -u ../magic-false-memory/photo.js kalis_magic_playground/zz9/photo.js`: 차이 존재(원 명령은 head와 묶인 pipeline으로 exit 0 반환); GUIDE_KEY·1회 가이드 추가 확인.
- 초기 entrypoint 조사 Python: exit 1, zz9/app.mjs 추정이 없어서 실패. index.html:94를 다시 확인하여 photo.js로 바로잡았다. 초기 zsh wildcard 지침 탐색도 존재하지 않는 AGENTS glob으로 실패했고 앱 코드는 쓰지 않았다.

이 감사에서는 앱 실행·화면 인증·npm verify를 수행하지 않았다. 루트 담당이 baseline을 별도로 수행한다. 구현 종료 필수 검증은 각 원본의 기존 npm test, 미러 byte 비교, `node --test tests/community/build-public.test.mjs`, 프로젝트 CLAUDE.md의 `npm run verify`, 공유 dist/tools의 baseline 목록/해시 비교다. 모바일 A-H·Fold resize·짧은 viewport/키보드 스트레스·설정 마지막 CTA·가로 공연을 별도 확인하며 실기 미검증을 에뮬레이션으로 통과 표시하지 않는다.

STATUS: DONE
Files changed: 이 문서 1개.
Verification: 읽기 검사 및 해시 검사 exit 0; 잘못 추정한 zz9 entrypoint 조사 exit 1 뒤 수정; 앱 테스트는 감사 범위에서 미실행.
Open issues: 구현 시 공유 freeze 선행, zz9 원본/미러 차이 보존, 모든 앱 폼·모바일 검증 필요.
