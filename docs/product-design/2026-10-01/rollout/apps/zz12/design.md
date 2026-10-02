# 멤덱 연습실 · 확대 적용 설계

상태: 2026-10-01 승인된 개인 앱 설정 B 확대 적용 기준. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 앱별 차이만 기록한다. 이 문서는 설계 계약이며 구현·실기 검증 완료의 증거가 아니다.

## 1. Product / Artifact concept

담당 개념은 **학습 동반 도구 · 기억의 훈련**, 유물 해석은 **같은 세계의 도구를 다루기 위한 52장 카드 서가**다. 첫 감정은 “차분함과 해낼 수 있다는 감각”이다. 의미는 [세계관 원문](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>) 및 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 멤덱 연습실 행에 근거한다. 52장 카드 서가는 이번 역할 제안이며 원문에 없는 새 세계관 담당 개념을 확정하지 않는다.

## 2. Settings UI identity

[공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 승인된 설정 B를 사용한다. 따뜻한 공통 셸의 얕은 기록 면, 동일한 타이포·필드·버튼·간격이 판단의 70%를 맡는다. 왼쪽 제목·설명 묶음과 오른쪽 크게 확대한 **카드 색인·위치 번호**의 세로 중심을 맞춘다. 상징은 조작 버튼이 아닌 장식이며 제목과 입력을 가리지 않는다. 기존 환경설정·백업 화면에 있는 기록 옮기기, 카드 순서 가져오기, 홈 화면 설치 안내, 순서 출처와 기존 선택값만 공통 설정 B로 정리한다. [현재 renderSettings](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz12/app.mjs>)의 내보내기·가져오기·안전 백업·순서 검증·기록 초기화 계약을 보존한다. 새 학습 모드·보상·퀴즈·설정 옵션은 만들지 않는다.

스마트폰·태블릿 A–H만 제품 지원 대상으로 삼는다. 좁은 Fold cover에서는 상징의 폭을 줄여 읽기 공간을 보존하고 태블릿 설정은 최대 560px로 중앙 정렬한다. 44px 조작 타깃·48px 주요 행동·safe-area·세로 스크롤·IME 열린 상태의 마지막 행동 접근을 검증한다. PC 전용 UI·설정 버튼·Shift+Esc·desktop 분기는 제거한다. OS·브라우저 식별 차단은 추가하지 않는다. 태블릿 펜·터치, 모바일 폼 키보드·라벨·focus·접근성, 개발·자동화 도구는 보존한다.

## 3. Settings accent / motif / texture / motion

accent **`#ADB99B`**, secondary **`#7B8E79`**, motif **카드 색인·위치 번호**, texture **종이·펠트**를 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보에서 채택한다. 앱 차이 30%는 오른쪽 상징·작은 선택 표식·국소 재질로 표현한다. 공통 배경을 앱 색으로 덮거나 secondary를 본문색으로 쓰지 않는다. 입력·사진·카메라·QR·결과 위에는 재질을 얹지 않는다.

설정 진입에서 “카드·숫자 색인 강조가 짧게 이동”을 한 번만 짧게 표현할 수 있다. 저장·입력을 기다리게 하지 않고 reduced-motion에서는 정적인 상징을 유지한다. 새로운 공연 효과나 실제 기능을 뜻하는 모션으로 사용하지 않는다.

## 4. Performance UI

**학습 화면 현행 유지**. 학습용 정보 밀도·카드 빨강/검정·암기 카드·퀴즈·포카드·기억법·스택 표·학습 기록·복습·스택 전환를 보존한다. 이 앱은 실제 학습 동반 도구이며 공연 예외로 분류하지 않는다. 설정 전용 스타일은 기존 학습 헤더·소개·학습 표·탭·카드까지 확장하지 않는다. 근거: [현재 앱 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz12/index.html>). 설정 진입은 화면 기준 두 손가락 아래 스와이프를 보존하고 자동 전체화면은 추가하지 않는다.

## 5. Performance UI exception

해당 없음. 이 앱은 공연 디자인 예외가 아니다.

## 6. Forbidden changes

- 아스라이로 명명·새 세계관 담당 개념 확정·오답 은폐·게임 보상 과장.
- 기존 저장값·키·순서·숨은 상태·비밀 조작·동작 계약을 디자인 작업으로 변경하거나 관객 화면에 노출하는 변경.
- 공통 셸을 앱별 테마·폰트·navigation으로 다시 만들거나 상징을 여러 곳에 반복하는 변경.
- PC 전용 제품 UI를 되살리거나 OS·브라우저로 실행을 차단하는 변경. 모바일 폼 키보드·태블릿 펜·접근성·개발 자동화를 일괄 제거하는 변경.
- 학습 UI 리뉴얼, 새 학습 기능·옵션 추가, 가져오기·복습·기록 초기화 계약 변경.

## 7. Signature detail

설정 헤더 오른쪽의 **카드와 위치 숫자를 연결한 한 줄 색인**. 제품명과 색을 가려도 형태로 개별 정체성이 구분되어야 한다. 카드 색인·위치 번호가 학습 동반 도구 · 기억의 훈련의 의미를 한 지점에서 전달하고, 셸·입력의 공통 정렬은 같은 제품군임을 보여준다. 공연·학습 화면에는 이 signature를 새로 추가하지 않는다.

2026-10-02 안정화: 연습 화면을 먼저 표시한다. 기록 읽기 실패와 기록 없음을 구별하며, 읽기 실패 후 연습·스택 변경·기억법 저장으로 기존 기록을 덮어쓰지 않는다. 백업 복원은 읽을 수 있던 원본의 기기 내 보존 사본을 검증한 뒤 적용한다. 원본을 계속 읽지 못하거나 보존·저장에 실패하면 교체하지 않는다. 다운로드 요청과 완료를 구별한다. 학습·포카드·기억법·복습의 기존 기능과 외형은 유지한다.
