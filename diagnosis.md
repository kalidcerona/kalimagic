# 공개 앱 15개의 이전 데이터와 설정 패널

**결론은 옵션 A다.** 기존 공개 빌드에서는 설정을 열 수 있는 누구에게나 가져오기 패널이 표시됐다. 후보가 없는 기기에도 ‘백업 파일 가져오기’가 보였다. 완료된 가져오기의 활성 설정과 사진은 공개 앱 자체 저장소에 있다. 중단된 쓰기를 복구하는 시작 순서와 TYCHE의 첫 실행 처리가 여전히 필요하므로, 패널 생성과 배포만 종료한다.

## 가져오기와 다음 실행

기준 커밋 `a46acf1`의 `kalis_magic_playground/zz-import/ui.mjs`에서 ‘가져온 이전 ZZ본을 바로 사용’을 선택하면 `applyImport`에 `activate: 'zz'`가 전달된다. 선택하지 않으면 병합본이 활성화된다. `apply.mjs`는 기존 값·가져온 값·병합본을 `zz-import-state-v1/state`의 `profiles:<target>`에 보관하고, 선택한 값은 `writeProfile`로 앱의 실제 저장소에 쓴 뒤 다시 읽어 검증한다. `activateProfile`도 같은 방식으로 선택한 프로필을 실제 저장소에 쓴다. 일반 실행에서 활성 프로필을 조회해 덧씌우는 구조가 아니다.

아래 경로는 모두 `kalis_magic_playground/` 기준이다. 키 매핑과 사진 대상의 전체 목록은 `zz-import/data.mjs`의 `TARGETS`와 `mapKey`, 실제 쓰기 방식은 `zz-import/apply-store.mjs`의 `browserStore`와 `writeMedia`에 있다. 표의 파일은 `distribution-snapshots/` 아래에 있으며 설정 키는 대표값이다.

| 공개 주소 | 앱이 읽는 localStorage와 읽기 경로 | 가져오는 사진의 공개 IndexedDB / 저장소 |
| --- | --- | --- |
| kairos | `friend-kairos_named_presets_v1` 등. `kairos/logic.js`의 키를 빌드 때 주소별로 변환 | 없음 |
| kairos-classic | `friend-kairos-classic_named_presets_v1` 등. 같은 정본을 별도 접두사로 변환 | 없음 |
| release | `unlock-settings-v1`, 공유 공연 연결 키. `unlock/logic.js`, `unlock/session.js` | `unlock-images / images` |
| hitsuzen | `magic-calc-date-delay`, 시간제·스킨·공유 공연 연결 키. `calculator/app.js` | 없음 |
| choice | `magic-choice-dist.v1.store`, 백업·아이콘. `choice/logic-core.js` | `magic-choice-dist.v1.media / wallpaper` |
| aletheia | `aletheia.distribution.meta.v1`, `custom12.v1`·`photoSets.v2`의 이미지 ID. `aletheia/dom.js` | `aletheia-distribution / images`에 Blob과 레코드 메타데이터 |
| tobira | `friend-tobira.v1`, 동전·배경 설정. `tobira/logic.js`, `tobira/dom.js` | `friend-tobira.localImages.v1 / images` |
| usotsuki | `usotsuki.distribution.detector.v1`, 소리·테마. `usotsuki/storage.js` | 없음 |
| asrai | `friend-asrai.prototype.v2`의 연락처·설정. `asrai/contacts-state.js` | 없음 |
| alter | `friend-alter-settings`의 카드·밝기. `alter/settings-store.js` | 없음 |
| tyche | `friend-spinner-state-v2`, 이전 v1, 테마. `spinner/app.js`와 빌드 시 첫 실행 보정 | 없음 |
| memdeck | `friend-memdeck-v1`의 스택·학습 진행. `memdeck/app.mjs` | 없음 |
| arosaegida | `magic-qr-session-v1-arosaegida`의 설정·세션. `qr/app.mjs` | 없음 |
| pimax | `pimax.distribution.settings`, `stats`, `session`. `pimax/state.mjs` | 없음 |
| uramichi | `friend-uramichi.web.presets`, 준비 상태·최근 기록·설정. `uramichi/presets.mjs` | 없음 |

`scripts/zz-import-build.mjs`는 15개 공개 주소 모두에서 접근 확인 → 복구 → 앱 스크립트 실행 순서를 만든다. `recoverImport`는 완료한 가져오기를 다시 적용하지 않는다. 미완료 저널이 있으면 다른 창을 확인하고 쓰기 전 상태와 사진을 복원한다. TYCHE의 `resume:tyche`는 첫 실행에서만 회전 상태를 보존하며 이후 평상시 시작 규칙으로 돌아간다. HITSUZEN의 `legacy-start.mjs`는 기존 저장 키 마이그레이션도 실행한다.

같은 빌드 모듈이 각 정본의 서비스 워커 `SHELL`에 배포 모듈 목록을 삽입한다. 설정 패널 모듈을 복사 목록과 오프라인 셸에서 함께 제외하고 새 캐시 버전을 사용한다. 앱별 정본이나 출시 핀, 기존 주소의 리디렉션을 수정할 필요가 없다. 이미 설치된 기기에서는 새 서비스 워커가 활성화되고 새 셸이 열릴 때 변경이 보인다.

## 로컬 검증 결과

`kalis_magic_playground/`에서 실행했다. 아래 브라우저 명령은 이미 설치된 드라이버를 사용했다.

```sh
export MAGIC_PLAYWRIGHT_MODULE=/Users/sumpie/.insane-search/node/node_modules/playwright-core
```

| 실행 명령 | 종료 코드 | 결과 |
| --- | --- | --- |
| `PATH=/opt/homebrew/opt/python@3.14/bin:$PATH npm run verify` | 0 | Node 2,584건 통과·5건 건너뜀, pytest 7건 통과·7건 건너뜀. 배포 파일 2,769개 안전 검사 통과. 사이트 검사 583건 중 실패 0건. |
| `npm run check:sources` | 0 | 승인된 정본 17개, 파일 582개 일치. |
| `node tests/fixtures/zz-import-browser.mjs` | 0 | 15개 앱에서 가져오기 전후 실제 설정 화면에 패널과 ZZ 문구가 없었고, 설정 값과 네 앱의 사진 해시가 일치했다. |
| `node tests/fixtures/zz-domain-browser.mjs` | 0 | 기존 도메인 샘플 14종을 적용하고 재실행 후 원문·사진을 대조했다. MEMDECK의 Mnemonica 스택, RELEASE의 갤럭시 설정, TYCHE의 7번째 회전 설정이 실제 컨트롤에 표시됐다. |
| `node tests/fixtures/zz-import-startup-browser.mjs` | 0 | 15개 앱에서 첫 터치가 앱 핸들러에 도달했고 가져오기 UI 요청은 0건이었다. |
| `node tests/fixtures/zz-import-offline.mjs` | 0 | 15개 오프라인 셸 시작, 중단된 쓰기 복구, 이전 셸 창 감지 통과. |
| `ZZ_A_MODULE_ROOT=./zz-migration node tests/fixtures/zz-import-failures.mjs` | 0 | 저장 공간 부족, 손상 파일, 중단된 쓰기, 복수 창을 포함한 9개 사례 통과. |
| `node tests/fixtures/zz-tyche-resume-browser.mjs` | 0 | v1과 v2 모두 첫 재실행에서 회전 상태를 복원했고 다음 일반 실행에서 정상 초기화했다. |

추가로 기준 커밋과 후보를 각각 빌드하여 전체 파일의 상대 경로와 SHA-256을 비교했다. 2,784개에서 2,769개로 줄었고, 차이는 정확히 15개 주소의 `zz-import/ui.mjs` 삭제, `zz-import/ui-bootstrap.mjs` 변경, `sw.js` 변경이었다. 별도 Chrome 세션에서는 기준 커밋의 MEMDECK 패널로 Mnemonica 스택을 가져온 뒤 같은 로컬 주소에서 새 서비스 워커를 활성화했다. 새 설정 화면에 패널이 없었고 선택한 스택과 저장된 스택 데이터 전체가 일치했다. 실제 운영자 기기 데이터는 사용하지 않았다.
