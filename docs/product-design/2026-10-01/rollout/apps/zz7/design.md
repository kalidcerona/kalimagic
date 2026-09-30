# USOTSUKI · 확대 적용 설계

상태: 2026-10-01 승인된 개인 앱 설정 B 확대 적용 기준. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 앱별 차이만 기록한다. 이 문서는 설계 계약이며 구현·실기 검증 완료의 증거가 아니다.

## 1. Product / Artifact concept

담당 개념은 **거짓 · 숨긴 것의 누출**, 유물 해석은 **감추려던 것이 작은 신호로 새어 나오는 탐지판**다. 첫 감정은 “가벼운 놀이 뒤의 들킨 듯한 긴장”이다. 의미는 [세계관 원문](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>) 및 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 USOTSUKI 행에 근거한다. 설정에서 사연을 암시하고 관객 화면에 세계관 설명을 강제하지 않는다.

## 2. Settings UI identity

[공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 승인된 설정 B를 사용한다. 따뜻한 공통 셸의 얕은 기록 면, 동일한 타이포·필드·버튼·간격이 판단의 70%를 맡는다. 왼쪽 제목·설명 묶음과 오른쪽 크게 확대한 **평평한 선에서 한 번 생기는 작은 균열**의 세로 중심을 맞춘다. 상징은 조작 버튼이 아닌 장식이며 제목과 입력을 가리지 않는다. 현재 실행 설정의 진실이 나올 시도, 소리, 검사 시간, 준비·검사 진동, 시도 초기화, 공연 시작, 사용 방법과 조건부 설치를 공통 설정 B로 정리한다. 입력 ID·저장 키·회차 파싱·유효성·진동 미지원 안내를 보존한다. 과거 app.js의 질문 묶음·리허설을 추가하지 않는다.

스마트폰·태블릿 A–H만 제품 지원 대상으로 삼는다. 좁은 Fold cover에서는 상징의 폭을 줄여 읽기 공간을 보존하고 태블릿 설정은 최대 560px로 중앙 정렬한다. 44px 조작 타깃·48px 주요 행동·safe-area·세로 스크롤·IME 열린 상태의 마지막 행동 접근을 검증한다. PC 전용 UI·설정 버튼·Shift+Esc·desktop 분기는 제거한다. OS·브라우저 식별 차단은 추가하지 않는다. 태블릿 펜·터치, 모바일 폼 키보드·라벨·focus·접근성, 개발·자동화 도구는 보존한다.

## 3. Settings accent / motif / texture / motion

accent **`#95B39C`**, secondary **`#8A6862`**, motif **평평한 선에서 한 번 생기는 작은 균열**, texture **무광 기기 표면**를 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보에서 채택한다. 앱 차이 30%는 오른쪽 상징·작은 선택 표식·국소 재질로 표현한다. 공통 배경을 앱 색으로 덮거나 secondary를 본문색으로 쓰지 않는다. 입력·사진·카메라·QR·결과 위에는 재질을 얹지 않는다.

설정 진입에서 “짧은 신호선이 한 번 갈라짐”을 한 번만 짧게 표현할 수 있다. 저장·입력을 기다리게 하지 않고 reduced-motion에서는 정적인 상징을 유지한다. 새로운 공연 효과나 실제 기능을 뜻하는 모션으로 사용하지 않는다.

## 4. Performance UI

**기존 기하와 동작 유지**. 신호 모니터·판정 패널·컨트롤 베이·검사 버튼의 기하·TRUE/LIE 즉시 판독·홀드 진행·조기 해제/이동 취소·회차·검사 시간·소리·진동를 보존한다. 실제 실행은 [detector.js](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz7/detector.js>)를 따르며, 실행되지 않는 과거 app.js의 질문·리허설 기능은 도입하지 않는다. 근거: [현재 앱 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz7/index.html>). 설정 진입은 화면 기준 두 손가락 아래 스와이프를 보존하고 자동 전체화면은 추가하지 않는다.

## 5. Performance UI exception

이번 확대 적용에서 공연 디자인 예외가 허용되는 앱이다. 변경은 따뜻한 중립 배경·무광 면·절제된 면 경계 등 표면에 한정한다. signal-monitor, result-panel, control-bay, detector-button의 기존 위치·크기·형태·입력 영역을 고정한다. TRUE/LIE 문구·의미색·홀드 임계값·짧은 홀드 취소·결과 표시 시점·회차·소리·진동을 변경하지 않는다. 판독 위 재질, 결과 reveal, 추가 딜레이·파동·glow는 금지한다. 같은 입력에서 같은 결과와 취소·타이밍이 나오는 기능 검증 및 기존 화면과 기하 대조가 통과 조건이다.

## 6. Forbidden changes

- 실제 생체·AI·의료 판정 주장·색만으로 결과 전달.
- 기존 저장값·키·순서·숨은 상태·비밀 조작·동작 계약을 디자인 작업으로 변경하거나 관객 화면에 노출하는 변경.
- 공통 셸을 앱별 테마·폰트·navigation으로 다시 만들거나 상징을 여러 곳에 반복하는 변경.
- PC 전용 제품 UI를 되살리거나 OS·브라우저로 실행을 차단하는 변경. 모바일 폼 키보드·태블릿 펜·접근성·개발 자동화를 일괄 제거하는 변경.

## 7. Signature detail

설정 헤더 오른쪽의 **한 번 갈라지는 짧은 신호선**. 제품명과 색을 가려도 형태로 개별 정체성이 구분되어야 한다. 평평한 선에서 한 번 생기는 작은 균열가 거짓 · 숨긴 것의 누출의 의미를 한 지점에서 전달하고, 셸·입력의 공통 정렬은 같은 제품군임을 보여준다. 공연에서는 새로운 상징을 더하지 않고 기존 신호·판정 UI의 표면만 절제해 정리한다.
