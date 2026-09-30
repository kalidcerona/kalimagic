# 앱별 Identity Matrix

상태: **v0.2 제안 · 구현 전** · 작성 2026-09-30.

공통 규칙은 [PRODUCT_DESIGN_SYSTEM.md](../../../PRODUCT_DESIGN_SYSTEM.md)를 참조한다. 이 문서는 공통 시스템의 복사본이 아니라 제품별 차이를 비교하는 자료다. 색·재질·미세 형태·signature는 설정 중심의 디자인 제안이며 현재 구현 사실이 아니다.

**적용 경계(사용자 수정 지시, 2026-09-30)**: 제품 소개는 세계관·공통 브랜드 표현 가능, 설정은 앱별 차별화의 핵심 영역, 공연은 **현행 유지**다. 공연 디자인의 예외는 **TYCHE / USOTSUKI만** 허용한다. 두 예외도 조작성·즉시 판독·기능 우선·기존 연출과 동작 계약을 보존한다. 다른 앱의 기존 공연 효과를 새로운 signature로 바꾸지 않는다. zz12의 학습 화면도 이번 범위에서는 현행 유지한다.

## 1. 세계관과 제품 범위

사용자가 제공한 [마술 앱 세계관 · 콘셉트 정리](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>)를 세계관의 원문 기준으로 삼는다. 현실을 구성한다고 믿던 **시간·선택·기억·진실·우연·기록**에 작은 틈을 만드는 도구들이다. 각 제품의 개성은 기능→담당 개념→유물의 형태→signature 순서로 연결한다.

원문에는 세계관 유물 12개가 있다. 현재 앱은 zz1–zz13의 canonical 13개이며, **zz12 멤덱 연습실은 별도의 학습 동반 도구**로 포함한다. 새 세계관 담당 개념이나 제품명을 만들어 확정하지 않는다. 원문 §12 아로새기다는 경로 zz13에 대응한다. FALSE MEMORY zz9는 PRIVATE이며 제품군의 개념 검토에는 넣되 공개 출시·구매·배포 대상에서는 제외한다.

배포용 KAIROS/KAIROS CLASSIC 등 별칭은 독립된 유물로 수를 늘리지 않는다. 원본 제품의 디자인 문서를 참조하고 필요한 외형·배포 차이만 후속 문서에 기록한다.

## 2. 의미가 비슷해 보이는 제품의 경계

| 제품 관계 | 구별할 개념 | 시각 언어의 차이 |
|---|---|---|
| KAIROS / TYCHE / HITSUZEN | 하나의 의미 있는 순간 / 우연이 잠깐 얻는 방향 / 과정 전체의 필연 | 단일 눈금 / 회전 원과 방향 / 여러 경로의 수렴 |
| RELEASE / TOBIRA | 닫힌 안쪽이 열림 / 화면과 현실 사이를 건넘 | 벌어지는 봉합선 / 가장자리의 문턱 |
| ALETHEIA / USOTSUKI | 원래 있던 진실을 발견 / 감추던 것이 신호로 샘 | 지워진 표면 / 반응 순간의 작은 균열 |
| 아스라이 / FALSE MEMORY | 희미한 기억이 다시 선명해짐 / 기억하던 모습의 확실성이 흔들림 | 남은 기록선 / 어긋난 사진 테두리 |
| ALTER / FALSE MEMORY | 같은 존재의 다른 얼굴 / 과거를 기억하는 방식의 의심 | 두 관측 윤곽 / 사진 기록의 두 테두리 |
| FALSE MEMORY / 아로새기다 | 기억이 재구성됨 / 기록된 길을 다시 새김 | 사진의 어긋남 / 지우고 새긴 잉크 흔적 |
| 아스라이 / 멤덱 연습실 | 기억을 되찾는 공연 / 기억을 훈련하는 실제 학습 | 연락처의 흔적 / 카드와 숫자의 반복 색인 |

이 해석은 마술의 서사다. 세계관 문장이 현실의 과학적 기능을 보증하지 않는다. 특히 점 변경만으로 임의 QR의 실제 목적지 URL을 바꾸는 능력이나 실제 생체 판독을 제품 기능으로 새로 주장하지 않는다.

## 3. Core concept · Artifact identity · 첫 감정

| 앱 | Core concept | Artifact identity | 처음 주어야 할 감정 |
|---|---|---|---|
| **KAIROS** · zz1 | 시간 · 결정적인 순간 | 수많은 시간에서 단 하나의 순간을 붙잡는 계측 유물 | 익숙함 뒤에 오는 정확함 |
| **RELEASE** · zz2 | 개방 · 봉인해제 | 닫혀 있던 안쪽 세계를 여는 봉인 장치 | 긴장 뒤의 풀림 |
| **HITSUZEN** · zz3 | 필연 · 하나의 결론 | 자유로운 과정이 이미 품고 있던 결론을 드러내는 계산판 | 평범함 뒤의 피할 수 없던 정확함 |
| **너의 선택은?** · zz4 | 인연 · 선택과 연결 | 멀리 떨어진 선택과 결과를 묶어 둔 기록장 | 자유롭게 고른 뒤에 발견하는 연결감 |
| **ALETHEIA** · zz5 | 진실 · 가려진 것의 발견 | 원래 있던 것을 가리고 있던 표면을 걷는 이미지 판 | 손끝으로 발견하는 경이 |
| **TOBIRA** · zz6 | 경계 · 문과 통로 | 화면과 현실 사이의 얇은 경계를 여는 표면 | 안쪽의 물건이 건너오는 듯한 감각 |
| **USOTSUKI** · zz7 | 거짓 · 숨긴 것의 누출 | 감추려던 것이 작은 신호로 새어 나오는 탐지판 | 가벼운 놀이 뒤의 들킨 듯한 긴장 |
| **아스라이** · zz8 | 기억 · 멀어진 흔적의 되살아남 | 희미한 한 사람의 흔적을 다시 찾는 주소록 | 친숙함과 오래 남는 여운 |
| **FALSE MEMORY** · zz9 · PRIVATE | 왜곡 · 기억의 재구성 | 처음 본 것과 지금의 자연스러운 모습 사이를 흔드는 사진 기록 | 뒤늦은 의심: 처음부터 이랬던가? |
| **ALTER** · zz10 | 이면 · 하나의 존재의 다른 얼굴 | 같은 현실의 다른 자아를 비추는 관측창 | 신뢰하던 화면에서 만나는 낯섦 |
| **TYCHE** · zz11 | 우연 · 잠깐 생기는 방향 | 누구 편도 아니던 우연이 한 번 방향을 갖는 회전판 | 기대와 몰입 뒤의 정확한 우연 |
| **멤덱 연습실** · zz12 | 학습 동반 도구 · 기억의 훈련 | 같은 세계의 도구를 다루기 위한 52장 카드 서가 — 역할 제안 | 차분함과 해낼 수 있다는 감각 |
| **아로새기다** · zz13 | 재작성 · 기록된 길의 끝 | 이미 존재하는 기록의 목적지를 다시 새기는 기록판 | 일상적인 QR 뒤의 의외성 |

## 4. Settings accent · Secondary accent · Motif · Texture

공통 설정 셸은 따뜻한 짙은 갈색과 크림을 유지한다. 아래 제안의 기본 적용 위치는 설정이며 제품 소개에서도 사용 가능하다. TYCHE·USOTSUKI 외 공연에 적용하지 않는다. 아래 accent는 면 전체를 덮는 테마색이 아니라 작은 표식·선택·기능 강조의 후보다. secondary는 재질용으로만 사용하고 본문색으로 쓰지 않는다. 종이·금속·유리는 사진 같은 스킨이 아니라 미세한 선과 낮은 명암의 재질 해석이다.

| 앱 | Accent 제안 | Secondary accent 제안 | Symbol / motif | Texture 제안 |
|---|---|---|---|---|
| KAIROS | `#C5A276` | `#9E7559` | 한 개의 짧은 눈금 | 무광 금속 |
| RELEASE | `#C88C76` | `#885549` | 분리되는 두 선과 작은 열린 틈 | 눌린 금속의 낮은 명암 |
| HITSUZEN | `#CABA97` | `#A78966` | 여러 경로가 끝에서 한 줄로 합쳐짐 | 평평한 종이·짙은 잉크 |
| 너의 선택은? | `#C08F87` | `#856A59` | 하나의 가는 연결선 | 종이·희미한 기록선 |
| ALETHEIA | `#D1C8B8` | `#9B9081` | 덮인 면과 지워진 가장자리 | 무광의 고요한 표면 |
| TOBIRA | `#A9B6A0` | `#758477` | 화면 가장자리의 작은 문턱 | 무광 금속·평면 |
| USOTSUKI | `#95B39C` | `#8A6862` | 평평한 선에서 한 번 생기는 작은 균열 | 무광 기기 표면 |
| 아스라이 | `#B3A8BB` | `#897F89` | 작게 남아 있는 기록의 흔적 | 부드러운 종이 |
| FALSE MEMORY | `#A1AFB2` | `#807F79` | 아주 조금 어긋난 사진의 두 테두리 | 무광 인화지 |
| ALTER | `#AAB7BB` | `#7F9598` | 겹쳐 있으나 완전히 일치하지 않는 두 윤곽 | 무광 금속·얇은 유리 |
| TYCHE | `#C3AA7D` | `#96815D` | 원과 한 방향을 가리키는 표식 | 무광 황동 |
| 멤덱 연습실 | `#ADB99B` | `#7B8E79` | 카드 색인·위치 번호 | 종이·펠트 |
| 아로새기다 | `#D0A18A` | `#8E6255` | 지우고 다시 새긴 점·끊긴 잉크선 | 설정의 종이·잉크 |

## 5. Settings motion · Performance UI · 동작 보존

설정 motion은 새 제안이고, 공연·학습 동작은 보존 대상이다. TYCHE·USOTSUKI의 공연 디자인은 후속 문서에서 별도 설계할 수 있지만 조작 영역·판독 속도·결과 의미·회차·타이밍을 바꾸지 않는다.

| 앱 | Settings motion 제안 | Performance UI 정책 | 기존 외형·동작 보존 대상 |
|---|---|---|---|
| KAIROS | 제목 옆 단일 눈금에 짧은 잔향 | 현행 유지 | 시간 수치·시작·정지·랩·공연 입력 |
| RELEASE | 설정의 봉합선 두 조각이 짧게 벌어짐 | 현행 유지 | PIN·잠금·리와인드·홈·기존 키패드와 스와이프 |
| HITSUZEN | 설정 구분선이 마지막 지점에서 정렬 | 현행 유지 | 일반 계산기·숫자 입력·계산 흐름 |
| 너의 선택은? | 설정의 두 표식을 연결선이 한 번 이음 | 현행 유지 | 평범한 홈·메모 목록·스와이프·항목 선택 |
| ALETHEIA | 설정 헤더의 선이 부분적으로 지워짐 | 현행 유지 | 검은 마스크·이미지·선택 확정 뒤 긁기 |
| TOBIRA | 설정 가장자리 문턱선의 짧은 이동 | 현행 유지 | 사용자 바탕·물체 이미지·탭·드래그·실물 타이밍 |
| USOTSUKI | 설정의 짧은 신호선이 한 번 갈라짐 | 예외 허용: USOTSUKI | 검사 버튼·홀드 진행·TRUE/LIE 즉시 판독·짧은 홀드 취소 |
| 아스라이 | 설정의 이름표 흔적이 희미함에서 선명함으로 | 현행 유지 | 연락처·검색·상세·돌아가기 |
| FALSE MEMORY | 설정의 이중 테두리만 짧게 어긋남 | 현행 유지 · PRIVATE | 일반 사진 화면·숨은 트리거·지연된 컷 교체 |
| ALTER | 설정 제목의 두 윤곽이 한쪽에서만 어긋남 | 현행 유지 | 실시간 카메라·카드 인식·프레임 밖 이동과 재진입 |
| TYCHE | 설정의 원과 고정 표식에 짧은 방향 변화 | 예외 허용: TYCHE | 회전판·최종 방향·목표 터치·회차·기존 가속과 감속 |
| 멤덱 연습실 | 설정의 카드·숫자 색인 강조가 짧게 이동 | 현행 유지 · 학습 화면 | 카드+숫자·퀴즈·포카드·기억법·복습·스택 전환 |
| 아로새기다 | 설정의 선을 지웠다가 다시 새기는 짧은 움직임 | 현행 유지 | QR 랜덤 생성기·생성·고정·점 편집·복귀·PNG |

## 6. 허용 예외 · 금지 표현 · Signature detail

signature는 슬로건이 아니라 설정 화면에서 반복되는 **형태·위치·움직임**이다. 제품 소개에서도 표현 가능하다. 공연 적용은 TYCHE·USOTSUKI만 허용하며 나머지는 현행 유지다. 한 화면에 주 모티프는 하나만 쓴다.

| 앱 | 공통 시스템에서 허용되는 예외 | 사용하면 안 되는 표현 | Signature detail 제안 |
|---|---|---|---|
| KAIROS | 스톱워치 외형·기존 숫자 글꼴·세로/가로 레이아웃 | 천체·룬·상시 비밀 표시 | 설정 제목 옆에 단 하나만 끊긴 눈금. 다른 앱처럼 원판 전체를 만들지 않음 |
| RELEASE | iPhone/Galaxy 모의 외형·개인 배경 | 발광 자물쇠·마법진·실제 OS 잠금 제어 주장 | 설정의 얇은 봉합선이 두 조각으로 열리는 디테일. 문 전체의 이동은 TOBIRA에 남김 |
| HITSUZEN | 계산기 외형·네이티브형 숫자·기능상 키 배치 | 마방진을 현행 기능으로 소개·답만 따로 발광 | 설정 그룹의 여러 얇은 구분선이 마지막 경계 한 곳에서 정렬되어 닫힘 |
| 너의 선택은? | 홈·메모의 익숙한 외형·사용자 배경 | 관객 화면에 붉은 실·정답 위치·강제 항목 강조 | 설정에서 떨어진 두 작은 표식을 하나의 가는 선이 묶음. 수렴하는 다중 경로와 구별 |
| ALETHEIA | 완전 검정 마스크·개인 이미지의 원색 | 무언가를 생성하는 UI·자동 긁기·장식 입자·숨은 칸 노출 | 설정 헤더의 구분선 한 부분에 지워진 가장자리. 공연 마스크와 이미지에는 새 디테일을 넣지 않음 |
| TOBIRA | 개인 홈 배경·실제 물체 이미지·필요한 빈 바탕 | 발광 포털·처음부터 보이는 물체·타이밍을 가리는 장식 | 설정의 한쪽 가장자리에만 짧은 문턱선. 공연의 기존 물체·바탕·가장자리는 현행 유지 |
| USOTSUKI | 진실/거짓의 기능 의미색·소리·지원 진동 | 실제 생체·AI·의료 판정 주장·색만으로 결과 전달 | 설정의 한 번 갈라지는 짧은 신호선. 공연 적용은 결과 판독을 방해하지 않는 범위의 예외로 별도 설계 |
| 아스라이 | 담백한 연락처 UI·기능상 정보 밀도 | 멤덱 앱으로 해석·실제 연락처 권한 요구·글자를 가리는 안개 | 설정의 한 구분선 끝에만 희미한 이름표 흔적. 공연의 한 사람만 장식으로 강조하지 않음 |
| FALSE MEMORY | PRIVATE 로컬 검토만; 평범한 사진 외형 | 공개 출시·구매 CTA·화려한 변형·크로스페이드·Google 상표 복제 | 제품 소개·설정에서만 이중 테두리를 조금 어긋나게 둠. 관객 화면의 교체를 설명하는 장식 금지 |
| ALTER | 카메라 원색·인식에 필요한 가림·기능상 화면 크기 | 네온 HUD·렌즈 장식·정지 사진 교체로 축약·물체 자체 변화 주장 | 설정 제목의 두 윤곽선이 한쪽에서만 엇갈림. 사진 기록 테두리가 아니라 관측면의 이중성 |
| TYCHE | 회전 동작·방향 확인 대비 | 목표 방향 미리 강조·카지노 네온·금화·slot 대시보드 | 설정의 작은 원과 한 개 고정 표식. 공연 적용은 기존 회전·방향 판독을 보존하는 예외로 별도 설계 |
| 멤덱 연습실 | 학습용 정보 밀도·카드 빨강/검정 | 아스라이로 명명·새 세계관 담당 개념 확정·오답 은폐·게임 보상 과장 | 설정의 스택 정보에서 카드와 위치 숫자를 한 색인 줄에 연결. 학습 화면은 이번 범위에서 현행 유지 |
| 아로새기다 | QR 순수 검정/흰색·판독 여백·중립 제목·공연 로고 비표시 | QR의 색·grain·glow·모티프 삽입·목표 링크 노출·브랜드명으로 공연 제목 교체 | 설정의 지웠다 다시 새긴 선. 공연 QR의 점·기능 표식·여백·중립 제목은 현행 유지 |

## 7. 원문과 실제 기능의 근거

세계관 원문은 사용자가 준 파일의 각 절을 따른다. 기능·명칭은 현재 canonical 소스로 확인했다. 파일명과 과거 handoff보다 현재 앱 명칭과 실제 동작이 우선한다.

- **KAIROS**: [zz1 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz1/index.html:12>). 세계관 원문 §1.
- **RELEASE**: [zz2 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz2/index.html:9>). 세계관 원문 §2.
- **HITSUZEN**: [zz3 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz3/index.html:13>). 세계관 원문 §3.
- **너의 선택은?**: [zz4 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz4/index.html:1>). 세계관 원문 §4.
- **ALETHEIA**: [zz5 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz5/index.html:1>). 세계관 원문 §5.
- **TOBIRA**: [zz6 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz6/index.html:1>). 세계관 원문 §6.
- **USOTSUKI**: [zz7 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz7/index.html:1>). 세계관 원문 §7.
- **아스라이**: [zz8 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz8/index.html:15>). 세계관 원문 §8.
- **FALSE MEMORY**: [zz9 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz9/index.html:16>). 세계관 원문 §9.
- **ALTER**: [zz10 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz10/index.html:15>). 세계관 원문 §10.
- **TYCHE**: [zz11 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/index.html:279>). 세계관 원문 §11.
- **멤덱 연습실**: [zz12 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz12/data.mjs:5>). 세계관 원문에 별도 담당 개념 없음. [현재 스택](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz12/data.mjs:5>)은 Patrick Redford와 Juan Tamariz의 Mnemonica. 학습 서가 정체성은 이번 제안.
- **아로새기다**: [zz13 소스](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz13/index.html:1>). 세계관 원문 §12.

공연 기능 확인에는 [기존 제품 카탈로그](</Users/sumpie/Desktop/AI/Projects/kalis magic/docs/magic-app-work/2026-09-26/product-catalog.md>)와 [현재 설정 개요](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/zz11/settings-ui.js:5>)를 함께 참조했다. 공개 경계는 [현재 빌드의 PUBLIC_DIRS](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/scripts/build-public.mjs:58>)와 [배포 별칭](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/scripts/build-public.mjs:220>)에 근거한다. 원문 세계관의 12개와 앱 경로 번호를 혼동하지 않는다.

## 8. 다음 단계의 개별 design.md

각 앱은 공통 SSOT 링크와 이 행의 차이만 기록한다. 다음 7개 항목으로 작성한다.

1. Product / Artifact concept
2. Settings UI identity
3. Settings accent / motif / texture / motion
4. Performance UI: 기본값 **현행 유지**
5. Performance UI exception: **TYCHE / USOTSUKI만 별도 디자인**; 나머지 해당 없음
6. Forbidden changes
7. Signature detail

최우선 검증은 설정창을 열었을 때 같은 세계의 제품으로 묶이면서 앱별 정체성이 구분되는가다. 공연은 기존 외형 유지 여부를 확인하고, 두 예외만 조작성·판독 속도·기능 우선·동작 계약의 보존을 검증한다. 이 단계에는 개별 design.md나 앱 시안·새 로고·코드 구현·배포가 포함되지 않는다.
