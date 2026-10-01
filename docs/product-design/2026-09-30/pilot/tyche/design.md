# TYCHE · 파일럿 설계

상태: 2026-09-30 승인된 설정 B·공연 A의 파일럿 구현 기준, 2026-10-01 PC 제거·카지노 장면 v2의 두 색상과 모서리 신호 구현 승인 반영. 공연 A의 원판·화살표 기하와 기존 동작 계약은 보존한다. 이 문서는 승인된 계약이며 구현·검증·배포 완료를 뜻하지 않는다. [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)와 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)를 상속하며 TYCHE의 차이만 기록한다. 390px 정적 비교 제안은 실제 성능이나 기기 검증을 뜻하지 않는다.

## 1. Product / Artifact concept

담당 개념은 우연이 잠깐 얻는 방향, 유물은 누구 편도 아니던 우연이 한 번 방향을 갖는 회전판이다. 의미는 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 TYCHE 행과 [현재 TYCHE 개요](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js>)를 따른다. 소개 문구 제안은 “우연이 잠깐 방향을 갖는 순간.”이다. 원과 한 개의 고정 표식으로 표현하며 과정 전체의 필연이나 시간을 붙잡는 계측 눈금과 구별한다.

## 2. Settings UI identity

390×844px 비교 시안은 두 대안에서 같은 필드·값을 사용한다. ‘위치 지정됨’, ‘네 번째’, ‘0회’는 비교용 상태다. 기존 필드는 선택한 목표, 목표에 멈출 차례(첫 번째부터 여덟 번째), 완료한 회전, 목표 다시 선택, 마술 시작, 조건부 앱 설치다. 2026-10-01 승인에 따라 설정 B 안에 44px 이상 조작 타깃의 ‘테이블 색’ 선택을 추가한다. 선택지는 ‘딥 그린’과 ‘와인 버건디’다. 테이블 색을 바꿔도 목표·회차·직전 결과·회전 각도를 초기화하지 않는다. 근거: [현재 설정 필드](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html>). 개요는 [개요 생성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js>)에서 추가되며 화면 커스텀은 [경로별 허용 조건](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js>)에 따라 달라진다.

| 대안 | 390px 화면의 차이 | 첫 화면에 보일 내용 | 비교 판단 |
|---|---|---|---|
| A · 방향의 표식 | 제목 옆 작은 원과 고정 표식. 열린 설정 행을 직접 배열 | 개요 한 줄·선택한 목표·차례 선택·완료한 회전·목표 다시 선택·마술 시작 | 작은 방향 표식만으로 개성을 만들고 과업을 빠르게 찾는가 |
| B · 회전의 판 | 헤더 오른쪽의 크게 확대한 원과 고정 표식을 왼쪽 제목·설명 묶음과 세로 중앙 정렬. 관련 행을 한 그룹으로 묶음 | 같은 필드·값·행동. ‘목표 방향과 회전 차례’ 묶음의 면 경계로 위계 형성 | 회전 유물의 감각이 장식 과잉 없이 설정 묶음으로 읽히는가 |

두 대안의 마술 시작·목표 다시 선택은 기존 재시작 동작을 유지한다. 목표 방향은 각도 대신 기존 ‘선택 전/위치 지정됨’으로 읽는다. 선택한 방향 그림·좌표·미리보기 화살표는 만들지 않는다. 설정 진입은 [현재 입력 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>)의 화면 기준 두 손가락 아래 스와이프를 보존한다. PC 전용 설정 버튼·Shift+Esc·리허설 진입은 제거하며 모바일 입력·접근성 키보드·태블릿 펜·터치·개발 자동화는 보존한다. 설치·커스텀은 조건부 기능으로 남기며 백업·복원 등 없는 필드는 제안에 넣지 않는다.

기기 지원은 최신 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)의 A–H 스마트폰·태블릿 클래스를 따른다. 390px 시안은 기준 화면이며 좁은 Fold cover와 태블릿에서도 설정 최대 폭 560px·44px 조작 타깃·스크롤·safe-area를 보존한다. 제품 지원은 스마트폰·태블릿만이다. PC 전용 설정 버튼·Shift+Esc·리허설 진입과 desktop 분기는 제거한다. OS·브라우저 식별 차단은 추가하지 않으며, 모바일 폼 입력·접근성 키보드·태블릿 펜·터치·개발 자동화는 보존한다.

## 3. Settings accent / motif / texture / motion

accent `#C3AA7D`, secondary `#96815D`는 [앱별 정체성 기준](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-09-30/APP_IDENTITY_MATRIX.md>)의 후보를 사용한다. A는 작은 원의 선과 고정 표식, B는 원형 inset 가장자리의 낮은 명암에 국한한다. 무광 황동은 반사광이나 금화 이미지 대신 면과 선으로 해석한다. 셸과 입력·버튼의 공통 규칙은 [공통 디자인 SSOT](</Users/sumpie/Desktop/AI/Projects/kalis magic/PRODUCT_DESIGN_SYSTEM.md>)를 참조한다.

모션 제안은 설정 진입에서 원의 짧은 방향 변화 한 번이다. 고정 표식은 이동하지 않고 원의 일부 선만 작게 이동했다 돌아온다. 목표 방향·회차와 연결하지 않는 독립 장식이며 reduced-motion에서는 정지 상태다. 공연 회전 애니메이션과 속도를 공유하지 않는다.

## 4. Performance UI

TYCHE는 승인된 공연 A의 회전판을 유지하고 배경 장면 후보를 비교하되 **현재 기하·입력·방향 판독·회차·타이밍을 고정**한다. 현재 화면은 고정 원판 위에서 중앙 화살표가 회전한다. 화살표는 [회전 화살표 SVG](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html>), 중앙 핀은 [중앙 핀 스타일](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css>)에 근거한다. 판 전체를 회전시키는 시안은 현행 동작과 다르다.

기하 기준은 [상하 레일](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css>), [원형 입력 영역](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css>): 위 레일 19dvh, 아래 레일 10dvh에 safe area가 더해지고, 원은 남은 영역 가운데 놓인다. 폭의 fallback은 `min(84vw, 100dvh - 190px, 640px)`, container 단위 지원 시 `min(90cqmin, 680px)`다. **390px 폭만으로 원판 크기를 확정하지 않는다.** 비교 시안의 높이는 844px, safe area 0, 기본 커스텀 값이라는 가정이며 현행 비율을 참조해 같은 중심·반지름으로 두 안을 그린다. 실기 화면의 크기를 측정했다는 주장은 하지 않는다.

첫 터치는 시작 위치를 목표로 저장하고 회전하지 않는다. 이후 드래그·탭으로 회전하며 바쁜 동안 입력 큐 최대 8개가 유지된다. 근거: [현재 입력 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>), [회전 큐](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>). 감속은 기본 1100ms, reduced-motion 50ms, `cubic-bezier(.12,.7,.13,1)`이며 완료 시 회차를 증가시킨다. 근거: [회전과 완료 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>). 목표 차례 외에는 목표에서 30도 초과, 직전 결과에서 10도 초과인 후보를 고르는 현재 계약도 유지한다. 근거: [결과 선택](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/logic.js>).

공연 아래 문구는 회전 중의 ‘회전 중…’만 표시되고 완료되면 비워진다. 완료 회전 수는 설정에만 있다. 근거: [공연 상태 영역](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html>), [설정 회차 표시](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>), [상태 문구 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>). 기존 원판 녹색 포켓은 정적인 형태로 남긴다. 화살표에 가려지던 녹색 섹터의 선택 완료 신호는 제거하고, 위쪽 두 모서리 다이아몬드로 옮긴다. 위 두 모서리는 목표가 없는 동안 어둡고 `state.targetAngle !== null`일 때만 승인된 v2 원래 밝기로 바뀐다. 아래 두 모서리는 항상 원래 밝기를 유지한다. 모든 모서리는 비상호작용·aria-hidden 장식이며 실제 목표 각도·회차·강제 순번을 드러내지 않는다. 근거: [입력·선택 상태 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>)와 [승인된 구현 브리프](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/briefs/tyche-implement-colour-cues.txt>).

## 5. Performance UI exception

2026-10-01 사용자가 카지노 장면 v2의 **딥 그린·와인 버건디 두 팔레트와 위 모서리 선택 완료 신호**를 실제 앱에 구현하도록 승인했다. 첫 펠트·나무·가죽 재질 중심 시안의 벽지 같은 느낌은 기각된 이력으로 남기며, 승인된 v2 공간과 장면을 기준으로 한다. 승인된 원판·화살표·중앙 핀의 기하와 기존 선택·회전·판독 계약은 바꾸지 않는다.

‘테이블 색’은 천과 대응하는 승인된 원판 재질을 함께 전환한다. 전용 저장 키는 `zz11-table-theme-v1`이며 유효값은 `emerald`·`burgundy`뿐, 기본값은 `emerald`다. 잘못된 저장값이나 저장소 실패에서도 앱을 사용할 수 있어야 한다. 테이블 색 변경·저장은 목표·회차·직전 결과·각도를 유지하고 공연 재시작은 목표·회차를 초기화하되 색을 유지한다. 다시 실행하면 새 목표가 필요하지만 저장된 유효 색은 복원한다. 기존 사용자 커스텀 배경을 새 기본 배경이 강제로 덮지 않아야 한다.

위 두 다이아몬드는 목표 미설정 때만 어둡고 선택 완료 때 v2의 원래 밝기를 사용한다. 공연 시작·목표 다시 선택은 두 상단 신호를 어둡게 되돌리며 회전 중에는 밝기를 유지한다. 아래 두 모서리는 모든 상태에서 원래 밝기다. cue는 목표 유무만 표현하며 각도·회차·방향을 표시하지 않는다. 깜박임·결과 reveal·추가 지연·판독 위 재질은 추가하지 않는다. 기존 wheel-wrap의 cue class·dataset 계약은 유지하고 낡은 green-sector-core 동작 훅은 제거한다.

원판의 중심·반지름·화살표 끝·핀 크기·방향 판독·입력 좌표는 고정한다. 첫 목표 터치는 회전하지 않고, 강제 차례·무작위 후보·입력 큐 최대 8개·1100ms 감속과 reduced-motion 50ms·회차 증가·문구 표시 시점·두 손가락 아래 스와이프 계약은 유지한다. 근거는 [현재 입력과 재시작 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/app.js>)·[현재 기하](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/style.css>)·[승인된 구현 브리프](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/product-design/2026-10-01/rollout/briefs/tyche-implement-colour-cues.txt>)다.

후속 구현의 통과 조건은 실제 DOM의 두 상단 cue·두 하단 불변·색 선택·저장·재실행과 기존 회전 동작 계약의 기능 검사다. PC 전용 진입은 제거하며 모바일 폼·접근성 키보드·태블릿 펜·터치·개발 자동화는 유지한다. 정적 시안만으로 동작·기기·배포 검증을 통과했다고 주장하지 않는다.

## 6. Forbidden changes

- 판 전체 회전, 중심·반지름·화살표 끝·핀 크기·터치 영역을 바꾸는 변경, 새 회전 시작 버튼.
- 목표 방향 미리 강조·목표 각도/강제 차례/완료 회전 수의 공연 노출. 상단 모서리 신호를 실제 목표 방향으로 이동하거나 하단 두 모서리의 밝기를 목표 상태에 연결하는 변경.
- 기존 감속·회전 큐·회차 증가·리셋·무작위 후보·방향 판독의 수정 또는 새 자동 전체화면 전환.
- 카지노 네온·금화·slot 대시보드, 설정 원형 장식의 과도한 반복, 판독을 가리는 질감과 glow.

## 7. Signature detail

설정의 **작은 원과 한 개의 고정 표식**. A는 제목 옆 열린 원, B는 얕은 inset의 가장자리로 형태를 바꿔도 방향 표식 하나라는 핵심을 유지한다. KAIROS의 끊긴 단일 선과 구별하고, 제품명을 가린 설정에서도 같은 공통 셸 안에서 우연의 방향을 느끼게 한다. 공연에서는 승인된 원판·화살표와 두 상단 모서리의 목표 유무 신호를 사용하며 다른 상징은 덧붙이지 않는다. 사용자가 설정 B와 공연 A를 선택했다. 설정 B의 상징을 오른쪽에 확대·세로 중앙 정렬한 수정 시안까지 승인했다. 공연 A의 원판·화살표·기하·동작은 유지한다. 2026-10-01 카지노 장면 v2의 두 테이블 색과 위 모서리 신호 구현이 승인됐다. 이 승인 기록은 적용·검증·배포 완료의 증거가 아니다.
