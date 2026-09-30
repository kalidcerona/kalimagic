# 현재 랜딩 페이지 디자인 분석

작성: 2026-09-30 · 범위: 공개 홈 [kalimagic.netlify.app](https://kalimagic.netlify.app/) · 앱 구현에 앞선 관찰 문서.

이 문서는 **현재 구현에서 관찰한 사실**과 **제품군으로 옮길 해석**을 구분한다. 과거 디자인 브리핑, 공용 CSS의 사용하지 않는 선택자, 앱 설정의 기존 테마는 랜딩보다 우선하지 않는다.

## 1. 분석 기준과 증거

최상위 시각 기준은 현재 공개 홈이다. 실제 화면을 1440×1000과 390×844의 브라우저 뷰포트로 확인했다. 스크롤바를 제외한 데스크톱 문서 폭은 1425px였다. 이는 특정 Android·iOS 실기 검증 결과가 아니다.

- [데스크톱 기준 화면](landing-desktop.jpg)
- [모바일 기준 화면](landing-mobile.jpg)
- [모바일 카드 흐름](landing-mobile-cards.jpg)
- 소스: [홈 HTML](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:17>), [공통 스타일](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:3>), [슬롯 생성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/content.js:26>), [내비게이션](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/nav.js:5>), [등장 모션](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reveal.js:25>).

홈의 룩은 공통 CSS만으로 결정되지 않는다. 인라인 스타일, 동적 슬롯, 모바일 전용 구조가 합쳐진 결과다. `--maxw:1080px`보다 홈 인라인 `max-width:1140px`가 실제 해당 컨테이너에 우선한다. 1024px 이하에서는 별도 모바일 subtree가 켜진다. 이 두 사실을 놓치면 색은 맞아도 현재 랜딩의 공간감과 흐름을 잘못 복제하게 된다.

## 2. 디자인 DNA — 왜 이 브랜드처럼 느껴지는가

**따뜻한 어둠 속에서, 가까운 사람이 조용히 쓸 수 있는 도구를 건네주는 느낌.**

짙은 갈색은 검정의 거리감을 누그러뜨리고, 크림색 글자는 종이와 사람의 체온을 떠올리게 한다. 선명한 테라코타는 금박의 과시보다 행동할 지점에 생기를 준다. 실제 사람과 반응이 담긴 사진은 초자연적 설정을 현실의 경험으로 붙잡는다. 강한 산세리프 제목과 드문 세리프 문장은 현대적 사용성 위에 조금 오래된 이야기의 결을 얹는다. 얇은 선, 넓은 여백, 낮은 표면 대비는 많은 장식 대신 자신감 있는 침묵을 만든다.

이는 시각 관찰에 대한 해석이다. 아직 랜딩에 완성된 ‘유물 제품군’ 체계가 구현되어 있다는 뜻은 아니다. 제품군은 이 DNA를 이어받아 유물의 서사를 추가한다.

## 3. 20개 항목 추출

| 항목 | 현재 랜딩의 관찰 | 브랜드로 느껴지는 이유 / 제품군으로 옮길 원리 | 근거 |
|---|---|---|---|
| Brand personality | ‘형’의 친근한 말투, 공감 후 실용적 제안. 마술을 사람 사이의 분위기를 바꾸는 도구로 설명 | 차가운 전문가보다 경험 있는 안내자. 유물도 이해하기 어려운 권위물이 아니라 손에 익는 도구 | [히어로·해결](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:82>) |
| Color palette | 바탕 `#1a1512`, 교차면 `#1f1815`, 카드 `#261d18`, 크림 `#f4efe9`, 보조 `#ab9f92`, 포인트 `#E8631F` | 갈색과 크림으로 온기, 오렌지로 행동의 초점. 이름이 point-gold여도 현재 색은 금색이 아님 | [현재 토큰](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:3>) |
| Background / surface hierarchy | 데스크톱 단색 바탕→교차 섹션→카드. 모바일 바깥 `#0E0805`, 셸 `#1A0F0A`, 패널 `#221512/#241712` | 표면의 작은 명도 차이로 깊이. 창마다 밝은 색이나 투명 유리로 분리하지 않음 | [모바일 표면](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:991>), [모바일 패널](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:447>) |
| Typography | Pretendard 중심, Noto Serif KR는 인용·번호·강조의 작은 영역 | 본문은 즉시 읽히고, 문장의 일부에서 오래된 기록의 결이 남음 | [폰트 로딩](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:17>), [세리프 사용](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/content.js:41>) |
| Font weight hierarchy | 본문 400 계열, 인용 500, 보조 CTA 600, kicker·주요 버튼 700, 헤드라인 800 | 크기를 모두 키우지 않고 굵기와 색으로 중요도 구분 | [히어로 위계](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:82>), [모바일 제목](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:1023>) |
| Spacing | 데스크톱 섹션 88·92px, 폭 안쪽 26px. 모바일 24px gutter, 장면 시작 48·56px, 카드 간 10·12px | 큰 단락은 숨을 쉬고, 카드 내부는 하나의 문장처럼 응집 | [데스크톱 여백](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:104>), [모바일 흐름](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:440>) |
| Grid | 홈 최대 1140px, 히어로 0.95:1.05, 해결 1:1, 제품 1.35:1, 방문 3열, 상황 5열. 모바일 최대 430px 단일 컬럼 | 단순 표 배열보다 사진과 문장이 번갈아 주도하는 편집 구조 | [홈 그리드](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:68>), [상황 5열](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:1035>) |
| Border / divider | 대체로 흰색 6–8%의 1px 경계. 일부 포인트 선·번호 원 | 두꺼운 기기 테두리 대신 조용한 분류와 정렬 | [경계 토큰](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:16>), [실제 카드 경계](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/content.js:41>) |
| Radius | 실제 방문 카드 desktop 6px, 리뷰 8px, 사진·CTA 10px 계열. 모바일 카드 14–18px, CTA 13px | desktop은 단정한 판, mobile은 손으로 다루는 친숙한 크기. pill은 표식에 제한 | [실제 카드 곡률](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/content.js:30>), [모바일 버튼](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:1009>) |
| Button style | desktop 오렌지 채움+짙은 글자, 투명 테두리 보조 버튼. mobile 테라코타 채움+크림 글자, 높이 54px | 주요 행동 하나에 온기를 집중. 색·대비 조합은 제품군에서 재검증 필요 | [히어로 버튼](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:88>), [모바일 CTA](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:1009>) |
| Card style | 낮은 표면 대비, 얇은 stroke, 제목→설명→행동. desktop 방문 30×26px, mobile 22×20px 안쪽 여백 | 대시보드의 상태 상자보다 내용을 담은 기록판 | [방문 카드 생성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/content.js:39>) |
| Icon style | 작은 수평선, 숫자 표식, 화살표, 소량의 ✦. FAQ에 이모지 일부 존재 | 기능을 안내하는 작은 기호가 중심. 별·이모지는 현재 존재 사실이며 제품군의 주된 문법으로 확대하지 않음 | [kicker 선](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:82>), [장식 bullet](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:172>) |
| Image treatment | 실사진 cover crop, 채도 .92·밝기 .86·대비 1.05 desktop hero. 사진 가장자리와 배경을 그라디언트로 접합 | 과장된 마술 소품보다 실제 관계와 반응이 신뢰를 만든다 | [히어로 이미지 처리](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:75>) |
| Texture | desktop 전면 fractal noise, opacity .05, soft-light. 모바일에 같은 전면 노이즈는 없음 | 디지털 면을 조금 무광으로 만듦. 제품군에는 필요한 비상호작용 표면에만 제한 | [현재 그레인](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:62>) |
| Shadow / glow | CTA 아래 따뜻한 shadow, 사진·일부 패널의 깊이. 장식 발광이 모든 요소에 있지는 않음 | 행동에만 무게를 주는 국소적 빛. 오래된 copper RGBA는 통일할 대상 | [CTA shadow](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:88>), [mobile shadow](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:1015>) |
| Motion | desktop reveal .8s/28px, 자식 stagger .08s; photo Ken Burns 22s; mobile .6s/22px·짧은 눌림. reduced-motion 규칙 존재 | 빠른 효과 과시보다 장면에 들어오는 리듬. 도구 화면에 22초 줌이나 긴 reveal을 복제하지 않음 | [모션과 감소 설정](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:39>), [실제 트리거](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/reveal.js:25>) |
| Navigation | KALI와 짧은 항목, sticky dark bar, 국소 blur와 hairline. 모바일에서도 실제 확인한 nav가 남음 | 위치는 명확하지만 콘텐츠보다 소리 높이지 않음. 앱에는 사이트 메뉴 7개를 그대로 이식하지 않음 | [nav 구성](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/nav.js:5>), [nav 표면](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/style.css:126>) |
| Information hierarchy | 공감→방문자 분기→장면→해결→경로→후기→소개·레슨→마무리 CTA. 모바일은 다른 순서와 묶음 | 사용자를 설명으로 압도하지 않고 다음 행동에 필요한 이유를 순서대로 줌 | [desktop 흐름](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:66>), [mobile 흐름](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:413>) |
| 빈 공간 | 사진·헤드라인 주위 넓은 여백, 본문 폭 제한, 장면 간 휴지. 모바일은 바깥 공백보다 내부 gutter와 묶음 간 간격 | 비어 있는 부분이 다음 장면과 중요한 단어를 돋보이게 함. 기능 화면의 조작 거리를 늘리는 공백은 금지 | [히어로 패딩](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:81>), [문장 폭](</Users/sumpie/Desktop/AI/Projects/kalis magic/kalis_magic_playground/index.html:84>) |
| 전체 감정과 분위기 | 늦은 시간의 따뜻한 실내, 담담함, 가까운 대화, 실제로 쓸 수 있을 것 같은 자신감 | 제품군의 신비는 온기와 현실감 위에 얹음. 호러·게임·럭셔리 전시장이 되지 않음 | 위 관찰의 종합 해석 |

## 4. 그대로 복사하면 안 되는 부분

1. **역사적 copper 색 잔존**: `rgba(224,144,78,…)`는 `#E0904E` 계열이며 현재 `--point-gold` 오렌지와 다르다. 모든 갈색·오렌지를 같은 토큰으로 간주하지 않는다.
2. **홈 전용 값과 미사용 CSS 구분**: 공용 `.vcard` 16px가 있어도 홈의 실제 슬롯 방문 카드는 인라인 6px. 놀이터·커뮤니티 전용 후반 CSS는 홈 DNA의 직접 근거로 사용하지 않는다.
3. **desktop/mobile의 차이는 정체성 분열이 아니다**: 여백·사진·카피의 강도는 달라도 갈색·크림·주황·친근한 서사는 유지된다. 제품 앱은 공통 정보 구조를 유지하면서 화면 폭에 맞게 배치한다.
4. **마케팅 모션과 도구 모션 분리**: 유물 소개의 분위기와 마술 공연 중 즉시 입력·인식·판독은 다른 기준이 필요하다.
5. **랜딩의 모든 대비 조합이 곧 접근성 통과는 아니다**: 좋은 분위기는 보존하고, 버튼 글자나 작은 설명의 대비는 정규화한다.

## 5. 대표 색 조합의 정량 점검

불투명 sRGB 선언값의 상대 휘도 계산이다. 렌더된 사진·반투명 면·오버레이·실기 화면 전체의 접근성을 검사했다는 뜻은 아니다. 일반 텍스트 기준은 [WCAG 2.2 대비 설명](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)의 4.5:1을 적용했다.

| 전경 | 배경 | 계산 대비 | 판단 |
|---|---|---|---|
| `#f4efe9` | `#1a1512` | 15.84:1 | 본문 기준 통과 |
| `#ab9f92` | `#261d18` | 6.38:1 | 본문 기준 통과 |
| `#E8631F` | `#1a1512` | 5.38:1 | 본문 기준 통과 |
| `#f4efe9` | `#E8631F` | 2.95:1 | 작은 본문에 사용하지 않음 |
| `#FBEFE6` | `#D94A1A` | 3.76:1 | 작은 본문에 사용하지 않음 |

따라서 제품군의 기본 주 버튼은 현재 오렌지 위의 짙은 글자를 기준으로 삼는다. 밝은 글자를 꼭 사용해야 하는 경우 채움색을 별도 검증한 더 어두운 토큰으로 바꾼다. 랜딩은 이번 단계에서 수정하지 않는다.

## 6. 제품군으로 이어지는 결론

- 고정할 것: 따뜻한 어둠, 크림색 가독성, 현대적 본문, 드문 세리프, 낮은 표면 대비, 얇은 선, 명확한 주요 행동, 여백의 리듬.
- 설정에서 변주할 것: 각 도구의 흔적·눈금·틈·겹침·기록이라는 형태, 보조색, 작은 재질 차이, 짧은 장식 모션. 제품 소개에도 세계관과 공통 브랜드를 표현할 수 있다.
- 적용 경계: 70% 공통 / 30% 개성은 설정 중심의 원칙이다. 공연은 **현행 유지**이며 브랜드 장식 추가·기능상 필요한 수정 외 디자인 변경은 금지한다. **TYCHE / USOTSUKI만** 공연 디자인을 허용하되 조작성·결과 판독·기능 우선·기존 마술 연출과 동작 계약을 보존한다. 멤덱 학습 화면도 이번 범위에서는 현행 유지한다.

공통 규칙은 [PRODUCT_DESIGN_SYSTEM.md](../../../PRODUCT_DESIGN_SYSTEM.md), 제품별 차이는 [APP_IDENTITY_MATRIX.md](APP_IDENTITY_MATRIX.md)를 따른다.

## 7. 사용자가 추가 제공한 자료의 반영

- [DESIGN-BRIEFING.md](../../../kalis_magic_playground/DESIGN-BRIEFING.md): ‘시네마틱 코칭’, 친근함과 프리미엄의 결합, 차가운 SaaS와 블랙+골드 클리셰 배제라는 **의도**를 보조 근거로 반영했다. 문서의 copper #E0904E와 과거 옵션 기본값은 현재 랜딩의 색·레이아웃을 덮어쓰지 않는다.
- [DESIGN.md](../../../kalis_magic_playground/DESIGN.md): 과거 포지셔닝 문서의 친근한 Magic Guide는 현재 카피를 이해하는 데 참고하되, 과거 ‘다크+골드’ 방향을 현재 토큰으로 취급하지 않는다.
- [마술 앱 세계관 · 콘셉트 정리](</Users/sumpie/Desktop/리소스/magic_apps_worldbuilding_and_concepts.md>): 앱별 **의미의 원문 기준**. 시각의 원문 기준인 현재 랜딩과 결합했다. ALTER는 일반적인 변형이 아니라 이면, ALETHEIA는 예언이 아니라 발견, FALSE MEMORY는 기억의 왜곡, 아로새기다는 기록의 재작성으로 구분한다.

자료가 충돌하면 시각은 현재 랜딩, 세계관 의미는 사용자 원문, 실제 기능은 현재 코드와 사용자 지시를 따른다. 외부 리소스 원문은 읽기만 했으며 수정·공개하지 않았다.
