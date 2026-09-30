# RELEASE · 확대 적용 설계

상태: 2026-10-01 승인된 개인 앱 설정 B 확대 적용 기준. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 앱별 차이만 기록한다. 이 문서는 설계 계약이며 구현·실기 검증 완료의 증거가 아니다.

## 1. Product / Artifact concept

담당 개념은 **개방 · 봉인해제**, 유물 해석은 **닫혀 있던 안쪽 세계를 여는 봉인 장치**다. 첫 감정은 “긴장 뒤의 풀림”이다. 의미는 [세계관 원문](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>) 및 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 RELEASE 행에 근거한다. 설정에서 사연을 암시하고 관객 화면에 세계관 설명을 강제하지 않는다.

## 2. Settings UI identity

[공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 승인된 설정 B를 사용한다. 따뜻한 공통 셸의 얕은 기록 면, 동일한 타이포·필드·버튼·간격이 판단의 70%를 맡는다. 왼쪽 제목·설명 묶음과 오른쪽 크게 확대한 **분리되는 두 선과 작은 열린 틈**의 세로 중심을 맞춘다. 상징은 조작 버튼이 아닌 장식이며 제목과 입력을 가리지 않는다. 기존 설정의 필드·라벨·저장·취소·접기·펴기·조건부 기능을 유지하고 관련 항목만 공통 설정 B의 기록 면에 묶는다. 확인되지 않은 백업·설치·커스텀 기능이나 빈 그룹은 추가하지 않는다.

스마트폰·태블릿 A–H만 제품 지원 대상으로 삼는다. 좁은 Fold cover에서는 상징의 폭을 줄여 읽기 공간을 보존하고 태블릿 설정은 최대 560px로 중앙 정렬한다. 44px 조작 타깃·48px 주요 행동·safe-area·세로 스크롤·IME 열린 상태의 마지막 행동 접근을 검증한다. PC 전용 UI·설정 버튼·Shift+Esc·desktop 분기는 제거한다. OS·브라우저 식별 차단은 추가하지 않는다. 태블릿 펜·터치, 모바일 폼 키보드·라벨·focus·접근성, 개발·자동화 도구는 보존한다.

## 3. Settings accent / motif / texture / motion

accent **`#C88C76`**, secondary **`#885549`**, motif **분리되는 두 선과 작은 열린 틈**, texture **눌린 금속의 낮은 명암**를 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보에서 채택한다. 앱 차이 30%는 오른쪽 상징·작은 선택 표식·국소 재질로 표현한다. 공통 배경을 앱 색으로 덮거나 secondary를 본문색으로 쓰지 않는다. 입력·사진·카메라·QR·결과 위에는 재질을 얹지 않는다.

설정 진입에서 “봉합선 두 조각이 짧게 벌어짐”을 한 번만 짧게 표현할 수 있다. 저장·입력을 기다리게 하지 않고 reduced-motion에서는 정적인 상징을 유지한다. 새로운 공연 효과나 실제 기능을 뜻하는 모션으로 사용하지 않는다.

## 4. Performance UI

**현행 유지**. iPhone/Galaxy 모의 잠금·PIN·리와인드·홈·기존 키패드·스와이프·사용자 배경를 그대로 보존한다. 설정 B의 배경·포인트·상징·재질·장식 모션을 공연으로 옮기지 않는다. 근거: [현재 앱 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz2/index.html>). 설정 진입은 화면 기준 두 손가락 아래 스와이프를 보존하고 자동 전체화면은 추가하지 않는다.

## 5. Performance UI exception

해당 없음. 이 앱은 공연 디자인 예외가 아니다.

## 6. Forbidden changes

- 발광 자물쇠·마법진·실제 OS 잠금 제어 주장.
- 기존 저장값·키·순서·숨은 상태·비밀 조작·동작 계약을 디자인 작업으로 변경하거나 관객 화면에 노출하는 변경.
- 공통 셸을 앱별 테마·폰트·navigation으로 다시 만들거나 상징을 여러 곳에 반복하는 변경.
- PC 전용 제품 UI를 되살리거나 OS·브라우저로 실행을 차단하는 변경. 모바일 폼 키보드·태블릿 펜·접근성·개발 자동화를 일괄 제거하는 변경.

## 7. Signature detail

설정 헤더 오른쪽의 **얇은 봉합선 두 조각 사이의 작은 틈**. 제품명과 색을 가려도 형태로 개별 정체성이 구분되어야 한다. 분리되는 두 선과 작은 열린 틈가 개방 · 봉인해제의 의미를 한 지점에서 전달하고, 셸·입력의 공통 정렬은 같은 제품군임을 보여준다. 공연·학습 화면에는 이 signature를 새로 추가하지 않는다.
