# 아로새기다 · 확대 적용 설계

상태: 2026-10-01 승인된 개인 앱 설정 B 확대 적용 기준. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 앱별 차이만 기록한다. 이 문서는 설계 계약이며 구현·실기 검증 완료의 증거가 아니다.

## 1. Product / Artifact concept

담당 개념은 **재작성 · 기록된 길의 끝**, 유물 해석은 **이미 존재하는 기록의 목적지를 다시 새기는 기록판**다. 첫 감정은 “일상적인 QR 뒤의 의외성”이다. 의미는 [세계관 원문](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>) 및 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 아로새기다 행에 근거한다. 설정에서 사연을 암시하고 관객 화면에 세계관 설명을 강제하지 않는다.

## 2. Settings UI identity

[공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 승인된 설정 B를 사용한다. 따뜻한 공통 셸의 얕은 기록 면, 동일한 타이포·필드·버튼·간격이 판단의 70%를 맡는다. 왼쪽 제목·설명 묶음과 오른쪽 크게 확대한 **지우고 다시 새긴 점·끊긴 잉크선**의 세로 중심을 맞춘다. 상징은 조작 버튼이 아닌 장식이며 제목과 입력을 가리지 않는다. 기존 설정의 필드·라벨·저장·취소·접기·펴기·조건부 기능을 유지하고 관련 항목만 공통 설정 B의 기록 면에 묶는다. 확인되지 않은 백업·설치·커스텀 기능이나 빈 그룹은 추가하지 않는다.

스마트폰·태블릿 A–H만 제품 지원 대상으로 삼는다. 좁은 Fold cover에서는 상징의 폭을 줄여 읽기 공간을 보존하고 태블릿 설정은 최대 560px로 중앙 정렬한다. 44px 조작 타깃·48px 주요 행동·safe-area·세로 스크롤·IME 열린 상태의 마지막 행동 접근을 검증한다. PC 전용 UI·설정 버튼·Shift+Esc·desktop 분기는 제거한다. OS·브라우저 식별 차단은 추가하지 않는다. 태블릿 펜·터치, 모바일 폼 키보드·라벨·focus·접근성, 개발·자동화 도구는 보존한다.

## 3. Settings accent / motif / texture / motion

accent **`#D0A18A`**, secondary **`#8E6255`**, motif **지우고 다시 새긴 점·끊긴 잉크선**, texture **설정의 종이·잉크**를 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보에서 채택한다. 앱 차이 30%는 오른쪽 상징·작은 선택 표식·국소 재질로 표현한다. 공통 배경을 앱 색으로 덮거나 secondary를 본문색으로 쓰지 않는다. 입력·사진·카메라·QR·결과 위에는 재질을 얹지 않는다.

설정 진입에서 “선을 지웠다가 다시 새김”을 한 번만 짧게 표현할 수 있다. 저장·입력을 기다리게 하지 않고 reduced-motion에서는 정적인 상징을 유지한다. 새로운 공연 효과나 실제 기능을 뜻하는 모션으로 사용하지 않는다.

## 4. Performance UI

**현행 유지**. QR 랜덤 생성기 제목·QR 순수 검정/흰색·판독 여백·생성·고정·점 편집·복귀·PNG·공연 로고 비표시를 그대로 보존한다. 설정 B의 배경·포인트·상징·재질·장식 모션을 공연으로 옮기지 않는다. 근거: [현재 앱 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz13/index.html>). 설정 진입은 화면 기준 두 손가락 아래 스와이프를 보존하고 자동 전체화면은 추가하지 않는다.

## 5. Performance UI exception

해당 없음. 이 앱은 공연 디자인 예외가 아니다.

## 6. Forbidden changes

- QR의 색·grain·glow·모티프 삽입·목표 링크 노출·브랜드명으로 공연 제목 교체.
- 기존 저장값·키·순서·숨은 상태·비밀 조작·동작 계약을 디자인 작업으로 변경하거나 관객 화면에 노출하는 변경.
- 공통 셸을 앱별 테마·폰트·navigation으로 다시 만들거나 상징을 여러 곳에 반복하는 변경.
- PC 전용 제품 UI를 되살리거나 OS·브라우저로 실행을 차단하는 변경. 모바일 폼 키보드·태블릿 펜·접근성·개발 자동화를 일괄 제거하는 변경.

## 7. Signature detail

설정 헤더 오른쪽의 **지웠다 다시 새긴 짧은 잉크선**. 제품명과 색을 가려도 형태로 개별 정체성이 구분되어야 한다. 지우고 다시 새긴 점·끊긴 잉크선가 재작성 · 기록된 길의 끝의 의미를 한 지점에서 전달하고, 셸·입력의 공통 정렬은 같은 제품군임을 보여준다. 공연·학습 화면에는 이 signature를 새로 추가하지 않는다.
