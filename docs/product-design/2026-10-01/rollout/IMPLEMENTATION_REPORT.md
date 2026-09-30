# 개인용 앱 설정 확장 · 구현 및 검증

작성: 2026-10-01. 최신 사용자 승인에 따라 나머지 앱의 설정 B를 확장하고 PC 전용 제품 조작을 제거했다. 공유판과 PRIVATE 경계는 유지했다. TYCHE 새 배경은 별도 시안 선택 대기이며 아직 앱에 적용하지 않았다.

## 변경 결과

- KAIROS·TYCHE의 승인된 설정 B는 유지. RELEASE·HITSUZEN·너의 선택은?·ALETHEIA·TOBIRA·USOTSUKI·아스라이·FALSE MEMORY(PRIVATE)·ALTER·멤덱·아로새기다 설정에 공통의 따뜻한 표면, 최대560px, 오른쪽 확대 상징을 적용. 각 앱 차이는 accent와 선·윤곽·짧은 기록의 형태로 제한했다.
- 공연·학습 외형은 보존했다. TYCHE·USOTSUKI도 이번 확장에서는 기존 공연판을 유지했다. 삭제는 PC 설정 버튼·Shift+Esc·PC용 PIN/학습 단축키·설치 안내뿐이며 모바일 폼 Enter/Escape, 자르기 접근성 방향키, 태블릿 펜·pointer·두 손가락 아래 스와이프는 보존했다.
- FALSE MEMORY는 로컬 비공개로만 수정했다. 현재 photo.js의 1회 가이드를 보존했으며, 없는 settings-ui.js 캐시 항목만 제거하여 기존 캐시 설치 실패를 막았다. zz9를 공개 목록·Git 커밋·사이트에 추가하지 않았다.
- 기존 생성기·사진·카메라·스택 데이터·목표 지정·회차·타이밍·저장 계약을 재설계하지 않았다. zz7 실제 detector.js와 zz8 contacts.js를 수정했으며 미사용 초안 app.js는 보존했다.

## 구조 판단과 리팩터링

[구조 감사](ARCHITECTURE_AUDIT.md)에서 개인용 변경이 공유 HITSUZEN/QR에 유입되는 입력 경계를 확인했다. 기존 다른 공유 앱과 같은 스냅샷 방식으로 두 입력만 고정했다. 새로운 통합 공연 엔진·프레임워크·의존성은 추가하지 않았다. 공통 settings-ui.js 복사본은 동작 계약을 크게 흔들 이유가 없어 유지했다.

공유 산출물은 변경 전138개, 변경 후138개, SHA-256 차이0이다. 근거 shared-before.json/shared-after.json. 새 고정본24개에는 기존 QR 벤더·라이선스를 그대로 복사했다. 새 캐시 이름은 배포 전 한 번의 변경 묶음으로 올렸으며 scope·start_url·오프라인 인증 보호는 유지했다.

개인 원본 미러는 mirror-before.json의 해시를 확인하고 변경된 파일만 동기화했다. 병행 변경을 덮어쓰지 않았다. PRIVATE zz9의 수동 차이는 원본으로 일괄 복사하지 않았다.

## 실제 워커

- Grok4.7/medium: 인프라, 세 구현 그룹, PC 잔여/터치 영역 정리, 오래된 PC·캐시 테스트 수정, SVG 배경 시안. 표준 계정·workspace sandbox·안정된 grok-worker.sh 경로를 사용했다. 유료 API로 전환하지 않았다.
- gpt-6.1-sol/medium 독립 워커: 구조 진단, SSOT/13개 앱 문서, 모바일 검증 도구·진단, 독립 코드/테스트 리뷰. 부모 세션 모델은 변경하지 않았다.
- Grok CLI에는 별도 이미지 생성 명령이 없어 시안은 Grok이 작성한 코드 기반 SVG이다. 실사 이미지 생성으로 표시하지 않는다.

## 검증 결과

| 실제 실행 | 종료 | 결과 / 근거 |
|---|---:|---|
| NODE_OPTIONS=--no-experimental-global-navigator npm run verify |0| JS336/336, Python4/4, 사이트478/478, dist601개; npm-verify-final.log |
| 각 원본9프로젝트 npm test |0| 총280개 통과; source-test-results.json 및 개별 로그 |
| 공유 dist/tools 파일목록·SHA-256 비교 |0| 138개, 추가·삭제·변경0; shared-after.json |
| mobile-verify.cjs 전체13×8 실행 |1| 초기104건 중 RELEASE E 설정 진입1회 실패; validation/final/report.json 보존 |
| RELEASE E 현재·기준 각8회 반복 |0| 16/16 성공, 실제 제스처 블록 바이트 동일; validation/release-entry/report.json |
| RELEASE8클래스 재검증 |0| 실패0, PNG54개; validation/release-final/report.json |
| TYCHE/USOTSUKI/QR/멤덱 가로2종 |0| 설정8건·실제 동작8건 실패0, 회전·짧은 홀드 취소·QR판독·카드 이동; release-entry/report.json |
| 최종 화면 비교 재계수 |0| 104케이스, 미해결 검사 실패0, PNG654개; validation/comparison/report.json |
| git diff --check 변경 앱·문서 |0| 공백 오류 없음 |

설정 검증은 280/320/390/480/744/768/820/1280px 세로, Fold cover→inner→cover, 긴 한국어, 실제 버튼44px, 입력 스크롤, 마지막 CTA 도달/가림, 가로 넘침, 내용 최대폭, 실제 env() 선언을 대체한 safe-area 합성 검사, 높이 축소 키보드 스트레스를 포함했다. 새 문제가 발견된 zz3/zz6/zz9/zz13 터치 영역은 Grok이 보완했다.

Node24 설치 환경의 navigator 전역 getter는 Node20 기준의 기존 DOM 테스트와 충돌하여 위 NODE_OPTIONS로 해당 실험 전역만 비활성화했다. 제품 코드를 이에 맞춰 변경하지 않았다. 초기 사이트 검사는 미러 동기화 중 차이 및 그 전역 충돌로 실패했고 최종 동기화 후 통과했다. 초기 원본4프로젝트 실패는 폐기한 PC 기능 또는 오래된 캐시 버전 기대값이며 해당 항목만 수정하고 마술·저장·프라이버시 검사는 유지했다.

새 인프라 전체 cached 공백 검사는 exit2였다. 기준본과 바이트 동일한 QR 벤더/라이선스3개 파일의 기존 공백 때문이며, 이3개만 제외한 새 변경 검사는 exit0이다. 기준본 공백을 정리하여 공유 바이트를 바꾸지 않았다.

## 시안과의 차이 및 보존 한계

- 실제 설정에는 기존 설치·커스텀·개요와 모든 기능 필드를 그대로 연결했다. 시안보다 항목 수가 많은 앱은 세로로 길어지고 스크롤을 사용한다.
- 멤덱은 별도 설정창을 만들지 않고 기존 설정 탭에만 디자인을 적용했다. 학습 헤더·탭·스택 조작은 보존했다.
- 280px에서는 상징 크기를 줄여 긴 제목과 겹치지 않게 했다. 태블릿 설정은 최대560px 중앙 열을 사용한다.
- 공연 픽셀 비교는 시간 표시를 마스킹하며 QR/사진/카메라의 동적 상태만으로 보존을 단정하지 않는다. 소스·핵심 모듈·실제 가로 동작의 별도 근거를 함께 검토했다.
- RELEASE 최초 간헐 실패의 원인은 확정하지 않았다. 아스라이의 느린 분할 스와이프는 기준·현재 모두 pointercancel이 발생하는 기존 한계이다. 실제 빠른 아래 스와이프는 모든 클래스에서 검증했다.
- Chromium 터치 에뮬레이션이다. Galaxy/iPhone/iPad 실기, iOS 엔진, 실제 OS IME·노치·시스템 표시 영역·실제 카메라 스캔은 미검증이다.

## TYCHE 배경과 배포 상태

첫 펠트·목재·가죽 바탕은 사용자가 벽지와 둥근 액자처럼 느껴진다고 기각했다. 카지노 테이블·열린 다트 캐비닛 공간 시안을 Grok이 다시 제작하고 7개 화면 캡처를 완료했다. 현재 사용자 선택 대기이며 앱에는 아직 미적용이다. 원판·화살의 기하와 기존 동작은 그대로 보존하며 배경만 선택 후 반영한다.

개인용 설정·PC 정리를 먼저 커밋하고 깨끗한 Git 원본 빌드·GitHub 두 브랜치 푸시·운영 파일 해시 검증을 진행한다. 이 문서 작성 시 아직 최종 푸시는 하지 않았다. 배포 완료 기록은 별도 PERSONAL_DEPLOYMENT_REPORT.md에 남긴다.

STATUS: PARTIAL
Files changed: 공개 개인 앱 파일, 비공개 zz9 로컬 파일, 원본 미러·회귀 테스트, 공통 SSOT·앱별 설계 문서.
Verification: 위 표의 실제 종료 코드와 결과 참조.
Open issues: 새 TYCHE 배경 선택·적용, 실기 확인, 최종 GitHub/운영 반영 확인.
