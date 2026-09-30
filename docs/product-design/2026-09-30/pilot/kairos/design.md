# KAIROS · 파일럿 설계

상태: 2026-09-30 승인된 설정 B의 파일럿 구현 기준. 공연 화면은 현행 유지. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며, 이 문서는 KAIROS의 차이만 기록한다. 아래 390px 배치는 정적 비교 시안을 위한 제안이며 실기 검증 결과가 아니다.

## 1. Product / Artifact concept

담당 개념은 시간과 결정적인 순간, 유물은 수많은 시간에서 단 하나의 순간을 붙잡는 계측 도구다. 의미는 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 KAIROS 행을 따른다. 제품 소개에서는 “흘러가는 시간 속에, 오래 남는 한 순간.”이라는 짧은 제안 문구와 단일 눈금으로 표현한다. 이미 존재하는 개요의 결정적 순간 이야기는 [현재 KAIROS 개요](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/settings-ui.js:5>)에 근거한다.

소개에서 느끼는 정확함은 설정의 정렬과 눈금으로 이어진다. 관객에게 보이는 스톱워치에는 이 서사나 표식을 옮기지 않는다.

## 2. Settings UI identity

390×844px 비교 시안에서는 같은 콘텐츠와 같은 선택값으로 두 대안을 비교한다. 모의 값은 세로 선택, 프리셋 이름 ‘생일’, 정지 문구 ‘00:06.47’이며 실제 저장값을 읽었다는 뜻이 아니다. 현재 설정은 공연 화면 방향, 숫자 그리드 사용법, 프리셋 목록과 편집을 제공한다. 프리셋 편집에는 이름·문구 숫자/숫자 순서·값 추가·적용 전 정지 횟수·저장이 있다. 근거: [현재 설정 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:228>), [프리셋 필드](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:247>).

| 대안 | 390px 화면의 차이 | 첫 화면에 보일 내용 | 비교 판단 |
|---|---|---|---|
| A · 순간의 눈금 | 헤더 오른쪽의 짧은 수평 색인선 한 곳에만 끊긴 눈금. 열린 설정 그룹을 평평하게 배열 | 제목·개요 한 줄·공연 화면 방향·프리셋 목록. 긴 사용법은 아래에 배치 | 조작 위치를 빨리 찾는 흐름과 단일 눈금의 정확함 |
| B · 기록의 판 | 헤더 아래 얕게 들어간 기록 면. 오른쪽의 큰 단일 눈금과 왼쪽 제목·설명 묶음의 세로 중심을 맞춤 | 같은 항목과 값. 프리셋 목록을 기록 면에 묶고 방향은 그 위에 배치 | 사연 있는 계측 도구의 감각과 입력 경계의 명료함 |

A의 열린 그룹, B의 묶음은 시안에서 보이는 상태를 뜻한다. 기존 접기·펴기와 저장 동작을 바꾸는 요구가 아니다. 기존 로고 자산은 보존한다. 정적 시안은 타이포와 눈금의 비교를 위해 로고 이미지를 생략했으며, 삭제·교체 결정이 아니다. 눈금은 별도 새 로고로 취급하지 않는다. 프리셋은 3칸 중 한 칸의 예시만 펼쳐 비교하며, 실제 목록 항목을 제거하는 제안이 아니다. 프리셋 만들기·편집은 목록에서 이어지는 별도 상태이며 첫 화면에 빈 편집기를 펼치지 않는다.

개요는 [개요 그룹 생성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/settings-ui.js:71>)에서 추가된다. 화면 커스텀은 [경로별 허용 조건](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/settings-ui.js:52>)에 따라 제공되므로 비교 시안은 배포 경로에서 조건부 기능을 보장하지 않는다. 백업·복원처럼 확인되지 않은 기능은 새 그룹으로 만들지 않는다. 즉흥 세팅은 [현재 별도 즉흥 세팅](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:271>)의 구분과 동작을 유지한다.

기기 지원은 최신 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 A–H 스마트폰·태블릿 클래스를 따른다. 390px 시안은 기준 화면이며 좁은 Fold cover와 태블릿에서도 설정 최대 폭 560px·44px 조작 타깃·스크롤·safe-area를 보존한다. PC용 최적화·별도 디자인·제품 UI 검증은 제외하되 기존 보조 입력과 개발 경로는 삭제하지 않는다.

## 3. Settings accent / motif / texture / motion

정체성 기준의 accent `#C5A276`, secondary `#9E7559`를 설정의 짧은 눈금·선택 표식에만 제안한다. A는 색인선의 면 분할, B는 기록 면의 얕은 음영으로 무광 금속을 암시한다. 입력 안과 프리셋 값에는 재질을 얹지 않는다. 큰 셸·타이포·버튼은 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)를 그대로 참조한다.

모션 제안은 설정 진입 후 단 한 번 눈금의 짧은 잔향이다. A는 끊긴 지점 옆의 선명도 변화, B는 같은 지점의 얕은 그림자 변화로 구별한다. 입력·저장 완료를 기다리게 하지 않고, reduced-motion에서는 정적인 눈금만 남긴다. 이는 현재 구현 사실이 아니다.

## 4. Performance UI

**공연 화면은 절대 변경하지 않는다.** 세로 스톱워치, 가로 숫자 표시, START/STOP·랩·하단 탭·숫자 글꼴·기존 입력 영역과 배치를 그대로 둔다. 가로 화면의 숫자·컨트롤·숨은 입력 영역은 [가로 공연 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:220>), 세로 탭은 [세로 탭 구조](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:215>)에 근거한다.

설정 진입은 화면 기준 두 손가락 아래 스와이프와 PC 설정·Shift+Esc를 보존한다. 근거: [스와이프 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:313>), [PC 진입 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:288>). 숫자 그리드 설명 그림과 공연의 보이지 않는 입력 영역을 혼동하지 않는다. 새 구획선·브랜드색·재질·눈금·소개 문구·장식 모션은 공연에 추가하지 않는다.

## 5. Performance UI exception

해당 없음. KAIROS는 공연 디자인 예외 앱이 아니다. 기존 설정의 화면 커스텀 기능도 이번 파일럿의 공연 변경 권한이 아니다. 두 대안은 설정과 제품 소개만 비교한다. 공연 시안이 함께 필요한 경우 현재 화면을 그대로 참조 표시하고 대안 이름을 붙여 새 디자인처럼 소개하지 않는다.

## 6. Forbidden changes

- 공연 숫자·글꼴·위치·세로/가로·시작/정지·랩·프리셋 적용·즉흥 세팅·숨은 입력 제스처의 수정.
- 설정 모티프를 공연 숫자나 버튼으로 확장하거나, 타이밍과 결과가 드러나는 상시 표시를 추가하는 변경.
- TYCHE와 같은 원판, 천체·룬·복수 눈금 띠로 단일 순간의 정체성을 바꾸는 표현.
- ‘이 칸에 저장’을 실제 기능 확인 없이 ‘저장하고 시작’으로 바꾸거나 기존 프리셋 편집과 설정 진입을 통합하는 변경. 근거: [기존 저장 버튼](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:264>), [설정·프리셋 분기](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:565>).

## 7. Signature detail

제목 근처의 **단 하나만 끊긴 짧은 눈금**. A에서는 열린 색인선, B에서는 얕은 기록 면의 오른쪽에 크게 놓지만 형태의 핵심은 같다. 제품명과 로고를 가려도 TYCHE의 원·방향 표식과 구별되어야 한다. 비교 시안의 승인 기준은 같은 공통 셸 안에서 A의 즉시 탐색과 B의 기록 감각이 눈금 하나로 드러나는가다. 사용자가 설정 B를 선택했다. 오른쪽 상징 확대·중앙 정렬을 반영한 수정 시안까지 승인되었으며 정적 시안 이후 320px·키보드·실기 조작성은 후속 구현에서 검증한다.
