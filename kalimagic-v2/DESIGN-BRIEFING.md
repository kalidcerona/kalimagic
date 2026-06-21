# KALI 마술 코칭 랜딩 V2 — 디자인 설계 브리핑 (Claude Designer → Claude Code 인수인계)

> 출처: Claude Designer가 작성. `옵션시스템.html`(standalone 변환본)의 설계 의도·결정 근거.
> 변환 작업: `옵션 시스템.dc.html`(DC 런타임) → `옵션시스템.html`(vanilla standalone). 2026-06-21.

## 포지셔닝
- 칼리형 = 마술 코칭 브랜드. 침착맨 마술 콘테스트 우승·대학 특강·방송 출연.
- 마술샵/공연 사이트 아님 → **시네마틱 코칭 랜딩** (관계코칭 공감구조 + 데이팅코칭 감정긴장 + 프리미엄 마술코칭 신비/신뢰).
- 핵심 감정: "마술 배워야겠다"보다 먼저 "나도 사람들 앞에서 저런 순간을 만들고 싶다".
- **절대 금지:** 블랙+골드 마술사 클리셰, 카지노/트럼프 과몰입, 픽업아티스트 느낌, 차가운 SaaS 느낌.

## 왜 옵션 시스템을 만들었나
1차 작업물(`index.dc.html`)에서 방향이 여러 갈래였음(Hero=영화적/따뜻/혼합 등). 한 번에 확정 않고 **칼리형이 눌러보며 고르는 비교 도구**가 필요 → 9섹션 × A·B·C variant.

## 기본값 (첫 진입)
`{ hero:'C', problem:'A', solution:'B', visitor:'A', path:'A', review:'B', lesson:'A', faq:'A', final:'A' }`

## 섹션별 옵션 (✓ = 기본 선택)
- **HERO**: A Cinematic Dark / B Warm Coaching / **C Charismatic Hybrid ✓**
- **VISITOR**: **A 3카드 분기 ✓** / B 세그먼트 탭 / C 질문형 행
- **PROBLEM**: **A 공감 질문 카드 ✓** / B Before 상태(image-slot) / C 상황 장면형(5씬)
- **SOLUTION**: A Magic as Tool / **B Magic as Transformation ✓** / C Social Weapon
- **PATH**: **A 3분기 카드 ✓** / B 계단 퍼널(5단계) / C 진단형(좌선택→우추천)
- **REVIEWS**: A 일반 6카드 / **B Before→After ✓** / C 페르소나별
- **LESSON CTA**: **A 상담 배너 ✓** / B 코칭 상품(1:1·소그룹) / C 신뢰형(수치+crew)
- **FAQ**: **A 아코디언 ✓** / B 카드 그리드 / C 카톡 대화형
- **FINAL CTA**: **A 5,000원 시작 ✓** / B 레슨 상담 / C 형이 골라줌

## 에셋 의도 용도 (디자이너 명시)
| 파일 | 디자이너 의도 | 현재 standalone 매핑(실사진) |
|------|------|------|
| stage-rose.jpg | Hero 배경 (무대 장미) | garage-demo-01 (공연 무대) |
| lecture-hands.jpg | Solution/Lesson (강의 중 손) | summer25-intimate-01 (가까운 레슨) |
| crowd-fists.jpg | Reviews 하단 군중 | summer24-crowd-02 (군중) |
| crew-thumbs.jpg | Lesson CTA 신뢰 (크루 엄지) | summer24-crowd-01 (사람들) |

> ⚠️ 실사진 매핑은 임시. 디자이너가 의도한 "무대 장미"·"엄지척"은 실제 다른 사진일 수 있음 → 칼리형 확인 후 교체.

## 컬러 토큰 (하드코딩, 변수 아님 — 비교용이라 팔레트 전환 없음)
배경 #1a1512 / #1f1815 · 카드 #261d18 / #241c17 · 텍스트 #f4efe9 · 뮤트 #ab9f92 · 강조 #E0904E(구리색)
폰트: Pretendard(본문) + Noto Serif KR(이탤릭 숫자·인용)

## 아직 결정 안 된 것 (병합 전 필요)
1. **About 섹션** — 1차엔 있고 옵션 시스템엔 없음. 최종 포함 여부·위치(Lesson 뒤 or Reviews 뒤) 미결.
2. **옵션 조합 확정** — 칼리형 피드백 대기.
3. **Problem B image-slot** — placeholder 상태. 실사진 교체 필요(현재 standalone은 그라디언트 placeholder).
4. **레슨 가격** — lesson 페이지 실가격 미기재(상담 후 안내).
5. **모바일 실기기 검증** — 반응형 클래스로 처리, standalone은 390px 스샷 검증 완료.

## 다음 작업 흐름
1. 칼리형 피드백 → 섹션별 옵션 확정.
2. **최종본 단일 파일 병합** — 선택 옵션만 남기고 옵션 UI(바·패널) 제거 → `index.html` 후보.
3. About 섹션 위치 결정.
4. 실사진 교체.
5. 1차 `index.dc.html` 폐기 or 보존 결정.

## standalone 변환 메모 (Claude Code)
- DC 문법(`sc-if`/`sc-for`/`{{}}`/`style-hover`)을 vanilla JS로 재구현. `support.js`·`image-slot.js` 의존 제거.
- 상태(sel/panelOpen/visTab/faqOpen/pathSel)·localStorage(`kali-options-v2`)·기본값 전부 원본과 동일.
- 내부 링크 `.dc.html` → 로컬 `.html`로 연결(intro/works/lesson/index).
- 검증: 콘솔 에러 0, 옵션 전환·동적블록·패널 토글·반응형 전부 작동.
