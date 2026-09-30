# TYCHE · 파일럿 설계

상태: 2026-09-30 승인된 설정 B·공연 A의 파일럿 구현 기준. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 TYCHE의 차이만 기록한다. 390px 정적 비교 제안은 실제 성능이나 기기 검증을 뜻하지 않는다.

## 1. Product / Artifact concept

담당 개념은 우연이 잠깐 얻는 방향, 유물은 누구 편도 아니던 우연이 한 번 방향을 갖는 회전판이다. 의미는 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 TYCHE 행과 [현재 TYCHE 개요](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js:15>)를 따른다. 소개 문구 제안은 “우연이 잠깐 방향을 갖는 순간.”이다. 원과 한 개의 고정 표식으로 표현하며 과정 전체의 필연이나 시간을 붙잡는 계측 눈금과 구별한다.

## 2. Settings UI identity

390×844px 비교 시안은 두 대안에서 같은 필드·값을 사용한다. ‘위치 지정됨’, ‘네 번째’, ‘0회’는 비교용 상태다. 현재 필드는 선택한 목표, 목표에 멈출 차례(첫 번째부터 여덟 번째), 완료한 회전, 목표 다시 선택, 마술 시작, 조건부 앱 설치다. 근거: [현재 설정 필드](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html:276>). 개요는 [개요 생성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js:71>)에서 추가되며 화면 커스텀은 [경로별 허용 조건](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js:52>)에 따라 달라진다.

| 대안 | 390px 화면의 차이 | 첫 화면에 보일 내용 | 비교 판단 |
|---|---|---|---|
| A · 방향의 표식 | 제목 옆 작은 원과 고정 표식. 열린 설정 행을 직접 배열 | 개요 한 줄·선택한 목표·차례 선택·완료한 회전·목표 다시 선택·마술 시작 | 작은 방향 표식만으로 개성을 만들고 과업을 빠르게 찾는가 |
| B · 회전의 판 | 헤더 오른쪽의 크게 확대한 원과 고정 표식을 왼쪽 제목·설명 묶음과 세로 중앙 정렬. 관련 행을 한 그룹으로 묶음 | 같은 필드·값·행동. ‘목표 방향과 회전 차례’ 묶음의 면 경계로 위계 형성 | 회전 유물의 감각이 장식 과잉 없이 설정 묶음으로 읽히는가 |

두 대안의 마술 시작·목표 다시 선택은 기존 재시작 동작을 유지한다. 목표 방향은 각도 대신 기존 ‘선택 전/위치 지정됨’으로 읽는다. 선택한 방향 그림·좌표·미리보기 화살표는 만들지 않는다. 설정을 여는 제스처·PC 진입은 [두 손가락 아래 스와이프](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:187>), [PC 설정 진입](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:208>)를 보존한다. 설치·커스텀은 조건부 기능으로 남기며 백업·복원 등 없는 필드는 제안에 넣지 않는다.

기기 지원은 최신 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 A–H 스마트폰·태블릿 클래스를 따른다. 390px 시안은 기준 화면이며 좁은 Fold cover와 태블릿에서도 설정 최대 폭 560px·44px 조작 타깃·스크롤·safe-area를 보존한다. PC용 최적화·별도 디자인·제품 UI 검증은 제외하되 기존 보조 입력과 개발 경로는 삭제하지 않는다.

## 3. Settings accent / motif / texture / motion

accent `#C3AA7D`, secondary `#96815D`는 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보를 사용한다. A는 작은 원의 선과 고정 표식, B는 원형 inset 가장자리의 낮은 명암에 국한한다. 무광 황동은 반사광이나 금화 이미지 대신 면과 선으로 해석한다. 셸과 입력·버튼의 공통 규칙은 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)를 참조한다.

모션 제안은 설정 진입에서 원의 짧은 방향 변화 한 번이다. 고정 표식은 이동하지 않고 원의 일부 선만 작게 이동했다 돌아온다. 목표 방향·회차와 연결하지 않는 독립 장식이며 reduced-motion에서는 정지 상태다. 공연 회전 애니메이션과 속도를 공유하지 않는다.

## 4. Performance UI

TYCHE는 예외 범위 안에서 아래 두 표면 대안을 비교하되 **현재 기하·입력·방향 판독·회차·타이밍을 고정**한다. 현재 화면은 고정 원판 위에서 중앙 화살표가 회전한다. 화살표는 [회전 화살표 SVG](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html:244>), 중앙 핀은 [중앙 핀 스타일](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css:99>)에 근거한다. 판 전체를 회전시키는 시안은 현행 동작과 다르다.

기하 기준은 [상하 레일](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css:32>), [원형 입력 영역](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css:58>): 위 레일 19dvh, 아래 레일 10dvh에 safe area가 더해지고, 원은 남은 영역 가운데 놓인다. 폭의 fallback은 `min(84vw, 100dvh - 190px, 640px)`, container 단위 지원 시 `min(90cqmin, 680px)`다. **390px 폭만으로 원판 크기를 확정하지 않는다.** 비교 시안의 높이는 844px, safe area 0, 기본 커스텀 값이라는 가정이며 현행 비율을 참조해 같은 중심·반지름으로 두 안을 그린다. 실기 화면의 크기를 측정했다는 주장은 하지 않는다.

첫 터치는 시작 위치를 목표로 저장하고 회전하지 않는다. 이후 드래그·탭으로 회전하며 바쁜 동안 입력 큐 최대 8개가 유지된다. 근거: [현재 입력 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:106>), [회전 큐](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:151>). 감속은 기본 1100ms, reduced-motion 50ms, `cubic-bezier(.12,.7,.13,1)`이며 완료 시 회차를 증가시킨다. 근거: [회전과 완료 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:159>). 목표 차례 외에는 목표에서 30도 초과, 직전 결과에서 10도 초과인 후보를 고르는 현재 계약도 유지한다. 근거: [결과 선택](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/logic.js:31>).

공연 아래 문구는 회전 중의 ‘회전 중…’만 표시되고 완료되면 비워진다. 완료 회전 수는 설정에만 있다. 근거: [공연 상태 영역](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html:252>), [설정 회차 표시](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:43>), [상태 문구 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:166>). 12시의 고정 녹색 섹터는 선택 완료 여부만 알리고 실제 목표 방향을 따라가지 않는다. 근거: [고정 선택 완료 표식](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:84>).

## 5. Performance UI exception

허용 범위는 TYCHE의 공연 **표면 스타일**이다. 아래 두 안은 회전판과 화살표의 현행 윤곽·조작 영역을 그대로 사용하고 배경·금속 광택·면 경계만 비교한다. 화면에 새 결과 숫자·상시 회차·제품 슬로건은 추가하지 않는다.

| 대안 | 표면 제안 | 고정해야 할 판독 요소 |
|---|---|---|
| 공연 A · 무광 회전판 | 사진 배경을 따뜻한 중립 무광 면으로 바꾸고 원판의 금속 반사를 낮춤. 얕은 황동 rim으로 면을 구분 | 고정 원판·방사형 화살표·중앙 핀의 같은 기하. 기존 섹터와 고정 완료 표식의 식별 대비 |
| 공연 B · 잉크 회전판 | 같은 기하 위에 짙은 잉크 면과 얇은 밝은 경계를 적용. 중심 핀과 화살표 끝의 대비를 우선 | A와 같은 중심·반지름·화살표 윤곽·방향. 고정 녹색 섹터와 선택 완료 상태의 의미 보존 |

현행 사진 배경은 [현재 stage 배경](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css:18>), 섹터·rim은 [현재 원판 기하](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html:71>)에 근거한다. 두 안의 표면 변경은 제안이며 적용 완료가 아니다. 화살표와 섹터 위의 노이즈, 멈춤 뒤 추가 반짝임·지연·결과 reveal은 넣지 않는다. 선택 완료 색은 현재 고정 위치와 상태 의미를 그대로 보존한다. 설정의 ‘마술 시작’과 ‘목표 다시 선택’, 차례 변경 시의 리셋 계약은 [재시작과 리셋 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js:220>)를 보존한다.

후속 구현의 통과 조건은 같은 입력 좌표에서 같은 각도, 같은 차례·결과·감속·문구 표시 시점, 같은 터치/PC 설정 진입이다. 정적 비교만으로 이를 통과했다고 주장하지 않는다.

## 6. Forbidden changes

- 판 전체 회전, 중심·반지름·화살표 끝·핀 크기·터치 영역을 바꾸는 변경, 새 회전 시작 버튼.
- 목표 방향 미리 강조·목표 각도/강제 차례/완료 회전 수의 공연 노출. 선택 완료 고정 섹터를 실제 목표 방향으로 이동하는 변경.
- 기존 감속·회전 큐·회차 증가·리셋·무작위 후보·방향 판독의 수정 또는 새 자동 전체화면 전환.
- 카지노 네온·금화·slot 대시보드, 설정 원형 장식의 과도한 반복, 판독을 가리는 질감과 glow.

## 7. Signature detail

설정의 **작은 원과 한 개의 고정 표식**. A는 제목 옆 열린 원, B는 얕은 inset의 가장자리로 형태를 바꿔도 방향 표식 하나라는 핵심을 유지한다. KAIROS의 끊긴 단일 선과 구별하고, 제품명을 가린 설정에서도 같은 공통 셸 안에서 우연의 방향을 느끼게 한다. 공연에서는 새 상징을 덧붙이지 않고 기존 원판·화살표가 이 언어를 담당한다. 사용자가 설정 B와 공연 A를 선택했다. 설정 B의 상징을 오른쪽에 확대·세로 중앙 정렬한 수정 시안까지 승인했다. 공연 A의 표면·기하는 이번 수정에서 유지한다.
