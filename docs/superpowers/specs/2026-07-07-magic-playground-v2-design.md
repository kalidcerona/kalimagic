# 마술 놀이터 V2 설계 스펙

작성일: 2026-07-07
대상: `kalis_magic_playground/playground.html`
상태: 확정

## 개요

마술 놀이터 V2는 기존 `playground.html`을 새 페이지 없이 게시판 허브로 확장하는 작업이다. MVP의 질문 폼과 카드 목록을 디시식 정보 구조의 목록형 게시판으로 바꾸고, 기존 다크 골드 아지트 톤을 유지한다.

제품 목표는 거대 커뮤니티가 아니라 마술인들이 가볍게 질문하고 기록을 남기는 작은 온라인 아지트다. 기능명은 현실적으로 유지하고, 문구, 빈 화면, 작성 안내, 포인트 일러스트에만 살짝 마법 감성을 둔다.

### grill 확정 사항 (2026-07-07)

- 작성자 본인의 글 삭제만 V2에 포함한다. 수정은 다음 단계로 둔다.
- 답변이 달린 질문은 삭제할 수 없다. 사용자 안내 문구는 `"답변이 달린 질문은 삭제할 수 없어요"`로 고정한다.
- 추천은 다시 누르면 취소되는 토글 방식으로 처리한다.
- 목록 번호 컬럼은 두지 않고 말머리부터 시작한다.
- 본문 읽기 권한이 없는 비공개 글은 조회수와 추천수를 `-`로 표시하고 추천 버튼을 숨긴다.

우선순위는 다음 순서로 해석한다.

1. `/Users/sumpie/.gstack/projects/kalidcerona-kalimagic/sumpie-main-design-20260707-magic-playground-v2.md`의 `office-hours 세션 답변`
2. `kalis_magic_playground/docs/COMMUNITY-V2-BRIEF.md`의 확정 카피
3. 기존 구현: `playground.js`, `netlify/functions/posts.mjs`, `supabase/migrations/20260706_magic_playground.sql`

히어로 eyebrow 문구는 이미 라이브에 반영된 `"마술인을 위한 놀이터"`를 유지한다.

## 범위(포함·제외)

### 포함

- `playground.html`을 게시판 허브로 확장한다.
- 탭은 `전체`, `질문함`, `리뷰`, `매거진`, `자유 기록🔒`로 구성한다.
- `리뷰` 탭은 도구 리뷰와 모임 후기를 통합한다.
- 리뷰 말머리는 `[도구]`, `[모임]` 두 개만 사용한다.
- `[모임]` 말머리일 때만 사진 선택 UI를 보여준다.
- `매거진`은 관리자가 후보 지정한 글 자동 노출과 관리자가 쓰는 큐레이션 글을 함께 보여준다.
- 목록은 `말머리 | 제목[댓글수] | 글쓴이 | 날짜 | 조회 | 추천` 테이블 구조로 표시한다.
- 공지글은 `📌` 표시와 함께 목록 상단에 고정한다.
- 더보기 방식 페이지네이션을 20개 단위로 적용한다.
- 조회수와 추천을 V2에 포함하되, 본문 읽기 권한 없는 비공개 글은 숫자 대신 `-`를 표시한다.
- 작성자 본인의 글 삭제를 V2에 포함한다.
- 카테고리별 글쓰기 가이드 문구를 폼 상단에 표시한다.
- 빈 목록에는 탭별 세계관 문구를 표시한다.
- 게시판 헤더와 빈 화면에 24x24 골드 라인아트 SVG 포인트 일러스트를 사용한다.
- `playground.js`를 목록, 글쓰기, 상세, API 통신 모듈로 분리한다.

### 제외

- 배지 시스템 전체는 V2에서 제외한다. 배지 테이블이 이미 있어도 부여 로직, 표시 UI, 배지 SVG 제작은 다음 단계다.
- 새 HTML 페이지를 만들지 않는다.
- `자유 기록` 글쓰기는 열지 않는다.
- 글 수정은 V2에서 제외하고 다음 단계로 둔다.
- 페이지당 개수 선택 드롭다운은 넣지 않는다.
- 조회수 어뷰징 방지는 넣지 않는다. 본문 읽기 권한자의 상세 열람 시 단순 증가만 한다.
- 직접 이미지 업로드는 넣지 않는다. 모임 후기는 기존 `event_photos` 사진 풀에서 2-5장을 선택한다.
- 비공개 질문 접근 제어 로직인 `access-policy`는 변경하지 않는다.

### 탭과 저장 매핑

| UI 탭 | 서버 필터 | 저장 방식 | 목록 말머리 | 작성 가능 |
|---|---|---|---|---|
| 전체 | `category=all` | `question`, `review`, `event_review`, `magazine` 공개글 통합 | 각 글의 말머리 | 현재 탭 기준 선택 유도 |
| 질문함 | `category=question` | `posts.post_type='question'`, `posts.category='question'`, `questions` 행 생성 | `[질문]` | 로그인 사용자 |
| 리뷰 | `category=review` | 도구 리뷰는 `posts.category='review'`, 모임 후기는 `posts.category='event_review'` | `[도구]`, `[모임]` | 로그인 사용자 |
| 매거진 | `category=magazine` | `posts.category='magazine'` 큐레이션 글과 `questions.magazine_candidate=true` 후보 질문 | `[매거진]`, `[질문]` | 관리자만 큐레이션 작성 |
| 자유 기록🔒 | 클라이언트 잠금 | `posts.category='free'`는 스키마에만 유지 | 없음 | 작성 불가 |

리뷰 말머리 저장을 위해 `posts.review_kind` 같은 새 컬럼을 만들지 않는다. 현재 스키마에는 모임 후기를 위한 `event_reviews` 보조 테이블이 있고, 기존 모임 후기 글은 `posts.post_type='event_review'`, `posts.category='event_review'`로 저장된다. 따라서 가장 충돌이 적은 방식은 `category='review'`를 `[도구]`, `category='event_review'`를 `[모임]`으로 매핑하는 것이다.

기존 `event_review` 카테고리 글은 V2 리뷰 탭에서 `[모임]` 말머리로 노출한다. 기존 `reviews.html`에서 작성된 모임 후기 역시 같은 매핑을 사용하므로 별도 마이그레이션 없이 리뷰 탭에 들어온다.

## 화면 설계

### 헤더와 탭

- 헤더 eyebrow: `마술인을 위한 놀이터`
- 헤더 제목: `마술 놀이터`
- 헤더 보조 문구: 현재 라이브 문구인 `질문은 묻히지 않게, 답변은 오래 남게.`를 유지한다.
- 탭 순서: `전체`, `질문함`, `리뷰`, `매거진`, `자유 기록🔒`
- `자유 기록🔒` 탭은 비활성처럼 보이되 클릭은 가능하다. 클릭하면 잠금 빈 화면과 `준비 중` 문구를 보여주고 목록 API를 호출하지 않는다.

### 목록 정보 구조

데스크톱 목록은 테이블형으로 렌더링한다.

| 컬럼 | 내용 |
|---|---|
| 말머리 | `[질문]`, `[도구]`, `[모임]`, `[매거진]` 중 하나 |
| 제목[댓글수] | 제목 뒤에 댓글 수를 `[3]` 형태로 표시한다. 댓글이 0개면 생략한다. |
| 글쓴이 | 접근 권한과 `display_mode`에 따라 닉네임 또는 익명 |
| 날짜 | 같은 해 글은 `MM.DD`, 다른 해 글은 `YYYY.MM.DD` |
| 조회 | `viewCount`. `canReadBody=false`면 `-` |
| 추천 | `likeCount`. `canReadBody=false`면 `-` |

공지글은 `posts.is_notice=true`인 글이다. 목록 정렬은 `is_notice desc`, `created_at desc` 순서다. 공지글 제목 앞에는 `📌`을 표시하고, 같은 공지끼리는 최신순으로 정렬한다.

번호 컬럼은 두지 않는다. 목록은 항상 말머리부터 시작한다.

모바일 목록은 2줄 압축 구조로 렌더링한다.

- 1줄: 말머리 + 제목 + 댓글수
- 2줄: 글쓴이 · 날짜 · 조회 · 추천. 본문 읽기 권한이 없는 비공개 글의 조회와 추천은 `-`로 표시한다.

### 더보기 페이지네이션

- 최초 목록은 20개를 불러온다.
- 더보기 버튼을 누르면 `offset`을 20씩 증가시켜 다음 20개를 붙인다.
- 서버가 `hasMore=false`를 반환하면 더보기 버튼을 숨긴다.
- 탭이나 말머리 필터가 바뀌면 `offset=0`부터 다시 불러온다.

### 빈 목록 문구

탭별 빈 화면 문구는 다음과 같이 고정한다.

| 탭 | 문구 |
|---|---|
| 전체 | 아직 첫 기록이 올라오지 않았습니다. 질문과 후기가 쌓이면 이 놀이터의 지도가 됩니다. |
| 질문함 | 아직 질문이 없습니다. 처음 묻는 질문도 다음 사람에게는 같은 고민을 해결하는 첫 기록이 됩니다. |
| 리뷰 | 아직 리뷰가 없습니다. 써본 도구와 모임 기억이 이곳에 쌓이면 누군가의 길잡이가 됩니다. |
| 매거진 | 아직 매거진에 건져 올린 글이 없습니다. 오래 남길 기록을 기다리고 있습니다. |
| 자유 기록🔒 | 자유 기록은 준비 중입니다. 질문함과 리뷰가 자리 잡은 뒤 열립니다. |

빈 화면에는 24x24 라인아트 SVG를 함께 둔다. SVG는 `stroke: var(--point-gold)`를 쓰고 배경은 투명하게 둔다.

### 글쓰기 동작

- 글쓰기 버튼은 현재 탭에 맞는 폼을 연다.
- `전체` 탭에서 누르면 카테고리 선택부터 요구한다.
- `질문함` 탭에서 누르면 질문 폼을 연다.
- `리뷰` 탭에서 누르면 말머리 선택 `[도구]`, `[모임]`을 먼저 보여준다.
- `[도구]` 선택 시 일반 리뷰 폼을 보여준다.
- `[모임]` 선택 시 기존 모임 후기 필드와 사진 선택 UI를 보여준다.
- `매거진` 탭에서 일반 사용자가 누르면 관리자 큐레이션 공간 안내만 보여준다.
- `매거진` 탭에서 관리자 또는 칼리 계정이 누르면 매거진 큐레이션 글쓰기 폼을 보여준다.
- `자유 기록🔒` 탭에서는 글쓰기 버튼을 비활성화하고 준비 중 안내를 보여준다.

로그아웃 상태에서 글쓰기 버튼을 누르면 로그인 안내를 보여준다. 목록과 공개글 열람은 로그아웃 상태에서도 허용한다.

### 글쓰기 가이드 문구

아래 문구는 폼 상단, 제목 placeholder, 본문 placeholder, 추가 안내 영역에 그대로 사용한다. 범위 표기는 문서 규칙에 맞춰 `2-5장`으로 표기한다.

#### 전체 게시판 (통합 보기 - 글쓰기 시 카테고리 선택 유도)

- 카테고리 안내: "어떤 기록을 남길지 먼저 골라주면 됨. 질문, 모임 후기, 도구 리뷰, 자유 기록 중에서 가장 가까운 곳에 남기면 사람들이 더 잘 찾아볼 수 있음."
- 제목 placeholder: "먼저 게시판을 선택하면 제목 예시가 나타남"
- 본문 placeholder: "남기고 싶은 이야기에 가장 가까운 게시판을 선택하면, 그 글에 맞는 안내가 열림"

#### 자유 게시판(자유 기록)

- 설명: "오늘의 연습, 문득 든 생각, 마술하면서 생긴 작은 이야기를 편하게 남기는 공간임."
- 제목 예시: "오늘 연습하다가 이런 생각이 들었음" / "카드 한 벌 들고 나갔다가 생긴 일" / "요즘 연습 중인 루틴 기록" / "오늘 마술 보여주고 느낀 점"
- 제목 가이드: "오늘 남기고 싶은 이야기를 한 줄로 적으면 좋음."
- 본문 가이드: "연습한 것, 느낀 점, 사람들 반응, 다음에 해보고 싶은 것을 편하게 적으면 됨. 짧아도 좋고, 기록처럼 남겨도 좋음."
- 추가 안내: "작은 기록도 쌓이면 누군가에게 길잡이가 됨."

자유 기록 가이드는 데이터와 카피를 미리 고정하기 위해 둔다. V2 화면에서는 잠금 상태이므로 작성 폼에는 노출하지 않는다.

#### 질문 게시판(마술 질문함)

- 설명: "마술을 배우다 막히는 순간이 있으면 질문을 남기는 공간임. 먼저 지나간 사람이 답을 알고 있을 수 있음."
- 제목 예시: "이 마술은 어디서 배워야 하나요?" / "제 마술 피드백해 주실 수 있나요?" / "카드 컨트롤은 어떤 순서로 연습하면 좋나요?" / "처음 보여주기 좋은 마술 추천받고 싶음" / "이 상황에서는 어떤 연출이 잘 맞을까요?"
- 제목 가이드: "궁금한 점이 바로 보이도록 한 줄로 적으면 답변받기 좋음."
- 본문 가이드: "궁금한 점과 현재 알고 있는 내용을 편하게 적으면 됨. 연습 중인 영상, 참고한 강의, 막힌 부분을 함께 남기면 더 구체적인 답변을 받을 수 있음."
- 유튜브 가이드: "피드백을 받고 싶은 영상이 있다면 유튜브 링크를 함께 붙이면 좋음. 질문을 보는 사람이 장면을 바로 보고 답변할 수 있음."
- 추가 안내: "처음 묻는 질문도 좋음. 누군가에게는 같은 고민을 해결하는 첫 기록이 될 수 있음."

#### 모임 후기 게시판

- 설명: "모임에서 느낀 분위기와 기억에 남은 순간을 남기는 공간임. 그날의 기록이 다음 모임을 더 좋게 만듦."
- 제목 예시: "이번 모임 다녀온 후기" / "처음 참석해본 플랜비 후기" / "오늘 모임에서 기억에 남은 순간" / "마술 없이도 재밌었던 모임 기록" / "다음 모임에도 가고 싶은 이유"
- 제목 가이드: "어떤 모임을 다녀왔는지 알 수 있게 적으면 좋음."
- 본문 가이드: "모임에서 좋았던 점, 기억에 남은 사람이나 순간, 다음에 추가되면 좋을 프로그램을 편하게 적으면 됨. 짧은 감상도 좋은 기록이 됨."
- 사진 선택 가이드: "칼리형이 올린 사진 중에서 마음에 드는 사진 2-5장을 골라 함께 남길 수 있음."
- 추가 안내: "모임 후기는 처음 오는 사람에게 가장 큰 안내서가 됨."

#### 리뷰 후기 게시판(도구 리뷰)

- 설명: "직접 써본 도구와 강의 경험을 남기는 공간임. 좋은 점과 활용 장면을 남기면 다음 사람이 선택하기 쉬워짐."
- 제목 예시: "이 덱 직접 써본 후기" / "초보자가 쓰기 좋았던 카드 도구" / "이 강의 보고 실제로 써본 느낌" / "실전에서 반응 좋았던 도구 리뷰" / "가격 대비 만족스러웠던 마술 도구"
- 제목 가이드: "무엇을 써봤는지와 어떤 느낌이었는지 드러나게 적으면 좋음."
- 본문 가이드: "사용해 본 도구나 강의의 장점, 실제로 써본 상황, 추천하고 싶은 사람을 적으면 좋음. 반응이 좋았던 장면이나 연습 난이도를 함께 남기면 더 도움이 됨."
- 추가 항목 가이드: "가능하면 가격대, 난이도, 필요한 준비물, 실전 활용도를 함께 적으면 기록의 가치가 커짐."
- 추가 안내: "내가 써본 경험이 누군가에게는 시행착오를 줄여주는 길잡이가 됨."

#### 매거진 게시판 (관리자 큐레이션)

- 설명: "마술 놀이터에 쌓인 좋은 질문과 답변, 후기와 리뷰를 골라 오래 볼 수 있게 모아두는 공간임."
- 일반 사용자 안내: "이곳은 마술 놀이터에서 오래 남기고 싶은 글을 모아두는 공간임. 좋은 질문, 좋은 답변, 좋은 후기, 좋은 리뷰가 매거진 후보가 될 수 있음."
- 관리자 제목 예시: "처음 마술을 배우는 사람에게 필요한 질문" / "입문자가 가장 많이 막히는 지점" / "모임 후기로 보는 마술 놀이터 분위기" / "실전에서 반응 좋았던 도구 모음" / "이번 주 좋은 질문과 답변"
- 관리자 제목 가이드: "나중에 다시 찾아보고 싶은 주제가 드러나게 적으면 좋음."
- 관리자 본문 가이드: "원글의 핵심, 답변에서 얻을 수 있는 배움, 다음 사람이 참고할 포인트를 정리하면 좋음. 원글과 답변을 연결해 작은 아카이브처럼 남기면 됨."
- 추가 안내: "매거진은 흘러가는 게시판에서 오래 남길 만한 기록을 건져 올리는 공간임."

### 상세 화면

- 상세 진입 시 `post-detail` API가 본문 읽기 권한자에 한해 조회수를 1 증가시킨다.
- 상세 상단에는 말머리, 글쓴이, 날짜, 조회수, 추천수를 보여준다.
- 본문 읽기 권한이 없는 비공개 글은 조회수와 추천수를 `-`로 표시하고 추천 버튼을 숨긴다.
- 추천 버튼은 상세 화면에 둔다. 같은 버튼을 다시 누르면 추천을 취소한다.
- 추천 응답의 `likeCount`와 `viewerLiked`로 추천수와 버튼 상태를 갱신한다.
- 로그아웃 상태에서 추천 버튼을 누르면 `"로그인하면 추천할 수 있어요"`를 보여준다.
- 작성자 본인 글에만 삭제 버튼을 보여준다.
- 삭제 버튼은 확인 후 서버 삭제 API를 호출한다. 답변이 달린 질문은 삭제하지 않고 `"답변이 달린 질문은 삭제할 수 없어요"`를 보여준다.
- 질문 답변, 댓글, 유튜브 lite embed, 비공개 본문 잠금 표시는 기존 상세 UX를 유지한다.

### 포인트 SVG 일러스트

- 배지 아이콘은 만들지 않는다.
- 게시판 헤더용 SVG 1개와 빈 화면용 SVG 1개를 만든다.
- 위치: `kalis_magic_playground/assets/playground/`
- 권장 파일명:
  - `board-spark.svg`
  - `empty-note.svg`
- 스타일:
  - `viewBox="0 0 24 24"`
  - `fill="none"`
  - `stroke="var(--point-gold)"`
  - `stroke-width="1.75"`
  - 둥근 선 끝 사용
  - 다크 배경 위에서 읽히는 단순 라인아트

## 데이터 모델

### 신규 migration

신규 파일 하나로 추가한다.

경로: `kalis_magic_playground/supabase/migrations/20260707_magic_playground_v2.sql`

```sql
alter table public.posts
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

alter table public.posts
  add column if not exists is_notice boolean not null default false;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx
  on public.post_likes (user_id, created_at desc);

create index if not exists posts_v2_public_list_idx
  on public.posts (status, is_notice desc, created_at desc);

create index if not exists posts_v2_category_list_idx
  on public.posts (status, category, is_notice desc, created_at desc);

alter table public.moderation_events
  drop constraint if exists moderation_events_action_check;

alter table public.moderation_events
  add constraint moderation_events_action_check
  check (action in (
    'hide',
    'restore',
    'delete',
    'answer',
    'edit_answer',
    'mark_magazine_candidate',
    'change_visibility',
    'pin_notice',
    'unpin_notice'
  ));

alter table public.post_likes enable row level security;
```

RLS 정책 0개 deny-all 전제는 유지한다. 모든 접근은 Netlify Functions service key를 통해서만 수행한다.

### 리뷰 말머리 저장 방식

새 `review_kind` 컬럼은 추가하지 않는다.

| 말머리 | 저장 조건 | 보조 테이블 | 작성 API |
|---|---|---|---|
| `[도구]` | `posts.post_type='review_comment'`, `posts.category='review'` | 없음 | `posts` |
| `[모임]` | `posts.post_type='event_review'`, `posts.category='event_review'` | `event_reviews`, `event_review_photos` | `event-reviews` 재사용 |

이 방식은 기존 `event_reviews` 관계를 유지하고, 기존 모임 후기 데이터를 리뷰 탭에 즉시 노출한다. `review_kind`를 새로 만들면 기존 `event_review` 데이터를 모두 역산해 채워야 하고, 기존 `event-reviews` API와 중복 상태가 생긴다.

### 작성 허용 post type

`validators.mjs`는 현재 `postType`이 `question` 또는 `event_review`가 아니면 `category='free'`로 매핑한다. V2에서는 이 동작을 바꾼다.

허용 작성 타입:

- `question` -> `category='question'`
- `review_comment` -> `category='review'`
- `magazine` -> `category='magazine'`, 관리자 또는 칼리만 가능

잠금 타입:

- `free`는 서버 작성 허용 목록에서 제외한다.
- `event_review`는 일반 `posts` API에서 직접 만들지 않고 기존 `event-reviews` API로만 만든다.

### 매거진 데이터

V2의 매거진 탭은 두 출처를 합친다.

1. 관리자 또는 칼리가 직접 작성한 `posts.category='magazine'` 글
2. 관리자가 후보 지정한 기존 질문 글: `questions.magazine_candidate=true`

리뷰와 모임 후기를 매거진에 오래 남길 때는 관리자 큐레이션 글에서 원글을 요약하고 링크한다. 전 카테고리 후보 플래그를 위해 `posts.magazine_candidate`를 새로 추가하지 않는다. 이번 migration 범위는 조회수, 공지, 추천 테이블에 고정한다.

### 목록 계산 필드

DB에 저장하지 않고 서버 응답에서 계산한다.

- `canReadBody`: 기존 `canReadPostBody` 결과
- `viewCount`: `posts.view_count`. `canReadBody=false`면 `null`
- `likeCount`: `post_likes`에서 `post_id`별 count. `canReadBody=false`면 `null`
- `viewerLiked`: 로그인 사용자가 해당 글을 추천했는지 여부. `canReadBody=false`면 `false`
- `commentCount`: `comments.status='visible'`인 댓글 수
- `prefix`: category 기반 말머리
- `boardCategory`: UI 탭용 가상 카테고리. `event_review`와 `review`는 둘 다 `review`

### 삭제 상태

작성자 삭제는 기존 `posts.status` 체계를 재사용한다. 물리 삭제하지 않고 `status='deleted'`로 soft delete 처리한다.

삭제 가능한 조건:

- 로그인 사용자이며 `requireViewer`를 통과한다.
- `posts.author_user_id = viewer.userId`다.
- 대상 글이 visible 상태다.
- 질문 글인 경우 연결된 답변이 없다.

답변이 달린 질문은 아카이브 보호를 위해 삭제하지 않는다. 서버는 400을 반환하고 사용자 메시지 `"답변이 달린 질문은 삭제할 수 없어요"`를 내려준다.

## API 설계

### `GET /.netlify/functions/posts`

목록 API다.

Query parameters:

| 이름 | 값 | 기본값 | 설명 |
|---|---|---|---|
| `category` | `all`, `question`, `review`, `magazine` | `all` | 탭 필터 |
| `reviewKind` | `tool`, `meeting` | 없음 | 리뷰 탭 안 말머리 필터 |
| `limit` | `20` | `20` | V2에서는 20으로 고정하고 서버가 20 초과 값을 20으로 제한 |
| `offset` | `0` 이상 정수 | `0` | 더보기 시작점 |

필터 규칙:

- `category=all`: `free`를 제외한 visible 글을 반환한다.
- `category=question`: `posts.category='question'`
- `category=review`: `posts.category in ('review', 'event_review')`
- `category=review&reviewKind=tool`: `posts.category='review'`
- `category=review&reviewKind=meeting`: `posts.category='event_review'`
- `category=magazine`: `posts.category='magazine'` 글과 `questions.magazine_candidate=true` 질문 글을 합친다.

정렬:

1. `is_notice desc`
2. `created_at desc`

응답 shape:

```json
{
  "posts": [
    {
      "id": "uuid",
      "postType": "question",
      "category": "question",
      "boardCategory": "question",
      "prefix": "질문",
      "title": "이 마술은 어디서 배워야 하나요?",
      "commentCount": 3,
      "authorLabel": "마술인07",
      "displayMode": "nickname",
      "visibility": "public",
      "status": "visible",
      "createdAt": "2026-07-07T00:00:00.000Z",
      "viewCount": 12,
      "likeCount": 4,
      "viewerLiked": false,
      "isNotice": false,
      "canReadBody": true,
      "bodyLocked": false
    }
  ],
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

목록 응답은 기존 `canReadPostBody`와 `canReadAuthor`를 계속 적용한다. 비공개 글의 본문과 유튜브 ID는 목록에서 노출하지 않는다.

`canReadBody=false`인 글은 `viewCount=null`, `likeCount=null`, `viewerLiked=false`로 반환한다. 프론트는 목록에서 조회수와 추천수를 `-`로 렌더링한다.

### `POST /.netlify/functions/posts`

일반 글 작성 API다.

인증:

- `requireViewer` 필수
- `postType='magazine'`은 `admin` 또는 `kali` 역할만 허용

요청:

```json
{
  "postType": "question",
  "title": "질문 제목",
  "body": "질문 본문",
  "visibility": "public",
  "displayMode": "nickname",
  "youtubeUrl": "https://youtu.be/abcDEF123_4"
}
```

V2 변경:

- `postType='review_comment'`를 허용하고 `category='review'`로 저장한다.
- `postType='magazine'`을 허용하고 `category='magazine'`으로 저장한다. 관리자 또는 칼리만 가능하다.
- `postType='free'`는 `400 invalid_payload`로 거부한다.
- `postType='event_review'`는 이 API에서 거부하고 `event-reviews` API 사용을 요구한다.
- 질문 작성 시 기존처럼 `questions` 행을 생성한다.

### `POST /.netlify/functions/event-reviews`

기존 모임 후기 작성 API를 유지하고, V2 리뷰 폼의 `[모임]` 말머리에서 재사용한다.

V2에서 `playground-compose`는 `[모임]` 선택 시 다음을 수행한다.

- `event-photos?eventCode=2026-08`로 사진 풀을 불러온다.
- 사진 2-5장 선택을 요구한다.
- 기존 `goodMoment`, `impressiveScene`, `nextProgram`, `messageToFirstTimer`, `youtubeUrl` 필드를 전송한다.
- 작성 성공 후 리뷰 탭을 새로고침한다.

### `GET /.netlify/functions/post-detail`

상세 API다.

V2 변경:

- visible 글을 찾은 뒤 기존 `canReadPostBody`로 본문 읽기 권한을 계산한다.
- `canReadBody=true`일 때만 `posts.view_count = posts.view_count + 1`을 실행한다.
- `canReadBody=false`이면 조회수를 올리지 않고 `viewCount=null`, `likeCount=null`, `viewerLiked=false`를 반환한다.
- hidden 또는 deleted 글은 관리자와 칼리 외에는 404를 반환하고 조회수를 올리지 않는다.
- 응답 `post`에 `viewCount`, `likeCount`, `viewerLiked`, `isNotice`, `canReadBody`를 포함한다.

기존 답변, 댓글, 비공개 본문, 비공개 답변 정책은 유지한다.

### `DELETE /.netlify/functions/posts`

작성자 본인의 글 삭제 API다.

인증:

- `requireViewer` 필수
- `posts.author_user_id = viewer.userId` 검증

요청:

```json
{
  "postId": "11111111-1111-4111-8111-111111111111"
}
```

성공 응답:

```json
{
  "ok": true,
  "status": "deleted"
}
```

에러 응답:

| 상황 | HTTP | 응답 |
|---|---|---|
| 비로그인 | 401 | `{ "error": "auth_required" }` |
| 본인 글 아님 | 403 | `{ "error": "forbidden" }` |
| 답변이 달린 질문 | 400 | `{ "error": "answered_question", "message": "답변이 달린 질문은 삭제할 수 없어요" }` |
| 없는 글 | 404 | `{ "error": "not_found" }` |
| hidden 또는 deleted 글 | 404 | `{ "error": "not_found" }` |

성공 시 `posts.status='deleted'`로 갱신한다. 기존 hidden/deleted 필터가 목록과 상세 노출을 막는다.

### `POST /.netlify/functions/post-likes`

추천 토글 API를 새로 만든다.

인증:

- `requireViewer` 필수

요청:

```json
{
  "postId": "11111111-1111-4111-8111-111111111111"
}
```

성공 응답:

```json
{
  "ok": true,
  "likeCount": 5,
  "viewerLiked": true
}
```

이미 추천한 글을 다시 누르면 `post_likes` 행을 삭제하고 다음 응답을 반환한다.

```json
{
  "ok": true,
  "likeCount": 4,
  "viewerLiked": false
}
```

에러 응답:

| 상황 | HTTP | 응답 |
|---|---|---|
| 비로그인 | 401 | `{ "error": "auth_required", "message": "로그인하면 추천할 수 있어요" }` |
| 본문 읽기 권한 없음 | 403 | `{ "error": "forbidden" }` |
| 없는 글 | 404 | `{ "error": "not_found" }` |
| hidden 또는 deleted 글 | 404 | `{ "error": "not_found" }` |

토글은 `post_likes`의 `primary key (post_id, user_id)`를 기준으로 한다. 기존 행이 없으면 insert, 있으면 delete를 수행한 뒤 현재 `likeCount`와 `viewerLiked`를 다시 계산해 반환한다.

### `POST /.netlify/functions/admin-moderate`

기존 moderation API에 공지 고정 액션을 추가한다.

신규 action:

- `pin_notice`: `posts.is_notice=true`
- `unpin_notice`: `posts.is_notice=false`

기존 action:

- `hide`
- `restore`
- `delete`
- `mark_magazine_candidate`
- `change_visibility`

`mark_magazine_candidate`는 기존처럼 질문 글의 `questions.magazine_candidate=true`를 설정한다. 대상 글이 질문이 아니면 `400 invalid_payload`와 사용자 메시지 `"매거진 후보 지정은 질문 글에서만 사용할 수 있어요"`를 반환한다. 리뷰와 모임 후기는 관리자 큐레이션 글로 매거진에 편집한다.

모든 moderation action은 `moderation_events`에 기록한다. `pin_notice`와 `unpin_notice`는 status를 바꾸지 않으므로 `before_status`와 `after_status`는 기존 status를 기록한다.

## 코드 구조

### 목표

현재 `playground.js`는 목록, 상세, 답변, 댓글, 글쓰기, API 통신을 모두 포함한다. V2에서는 역할별로 나눠 수정 범위를 줄인다.

### 파일 분리

`kalis_magic_playground/` 아래에 다음 파일을 둔다.

| 파일 | 책임 |
|---|---|
| `playground-api.js` | `fetchJson`, 목록, 상세, 글 작성, 글 삭제, 추천 토글, 모임 사진 API 호출 |
| `playground-list.js` | 탭 상태, 말머리 필터, 테이블 목록 렌더링, 빈 화면, 더보기 |
| `playground-compose.js` | 글쓰기 버튼, 카테고리 가이드, 질문 폼, 도구 리뷰 폼, 모임 후기 폼, 매거진 관리자 폼 |
| `playground-detail.js` | 상세 렌더링, 조회수와 추천 표시, 추천 토글, 본인 글 삭제 버튼, 답변 폼, 댓글 폼, YouTube lite embed |
| `playground.js` | bootstrap, shared state 연결, `window.MagicPlayground` 공개 API |

클래식 script 방식으로 유지한다. 각 파일은 `window.MagicPlaygroundApi`, `window.MagicPlaygroundList`, `window.MagicPlaygroundCompose`, `window.MagicPlaygroundDetail` 같은 명시적 namespace를 노출한다. 빌드 도구 없이 기존 정적 사이트 구조를 유지하기 위한 선택이다.

### HTML script 순서

`playground.html` 하단 script는 다음 순서로 둔다.

```html
<script src="auth.js"></script>
<script src="playground-api.js"></script>
<script src="playground-list.js"></script>
<script src="playground-compose.js"></script>
<script src="playground-detail.js"></script>
<script src="playground.js"></script>
```

### `build-public.mjs` 등록

신규 JS 파일은 `kalis_magic_playground/scripts/build-public.mjs`의 `PUBLIC_FILES`에 추가한다.

추가 항목:

```js
'playground-api.js',
'playground-list.js',
'playground-compose.js',
'playground-detail.js'
```

SVG 파일은 `assets` 디렉터리 아래에 두므로 `PUBLIC_DIRS`의 기존 `assets` 등록으로 배포된다.

### 서버 파일 변경

| 파일 | 변경 |
|---|---|
| `netlify/functions/posts.mjs` | `limit`, `offset`, `reviewKind`, 공지 정렬, 계산 필드, free 작성 거부, review 작성 허용, magazine 관리자 작성, 본인 글 삭제 |
| `netlify/functions/post-detail.mjs` | 본문 읽기 권한자 상세 조회 시 `view_count` 증가, 추천 계산 필드 추가 |
| `netlify/functions/post-likes.mjs` | 신규 추천 토글 API |
| `netlify/functions/admin-moderate.mjs` | `pin_notice`, `unpin_notice` 처리 |
| `netlify/functions/_lib/validators.mjs` | 작성 타입 매핑과 moderation action 검증 갱신 |

`access-policy.mjs`는 변경하지 않는다.

## 엣지 케이스

- 추천은 같은 사용자가 다시 누르면 취소된다. 취소 후 다시 누르면 재추천된다.
- 로그아웃 추천은 클라이언트에서 먼저 막고, 서버 401도 `"로그인하면 추천할 수 있어요"`로 처리한다.
- 본문 읽기 권한자의 상세 조회수는 단순 증가다. 새로고침, 뒤로가기 후 재진입, 같은 사용자의 반복 열람도 모두 증가한다.
- 본문 읽기 권한이 없는 비공개 글은 목록과 상세에서 조회수와 추천수를 `-`로 표시하고, 서버 응답은 `viewCount=null`, `likeCount=null`을 반환한다.
- 본문 읽기 권한이 없는 비공개 글 상세 진입은 조회수를 증가시키지 않는다.
- 기존 글은 `view_count=0`, `is_notice=false` 기본값으로 무해하게 호환된다.
- migration 전 코드가 먼저 배포되면 `view_count`, `is_notice`, `post_likes` 참조에서 서버 오류가 난다. 배포 순서는 migration 먼저다.
- `자유 기록🔒`은 UI에서 목록 API를 호출하지 않고 준비 중 화면을 보여준다.
- 서버는 `postType='free'` 작성을 거부한다.
- 기존 `event_review` 글은 리뷰 탭 `[모임]`으로 표시한다.
- 모임 후기 사진이 2장 미만이면 작성 버튼을 막고 기존 메시지 `"사진은 2-5장 골라줘."`를 보여준다.
- 비공개 질문의 본문, 작성자명, 유튜브 ID 노출 정책은 기존 `access-policy` 결과를 따른다.
- hidden 또는 deleted 글은 일반 사용자 목록과 상세에서 숨긴다.
- `is_notice=true`인 글도 hidden 또는 deleted면 목록에 나오지 않는다.
- 본인 글이어도 답변이 달린 질문은 삭제할 수 없다.
- 본인 글 삭제는 `status='deleted'` soft delete만 수행한다.
- 매거진 후보 지정은 질문 글에만 성공한다. 리뷰와 모임 후기는 관리자 큐레이션 글로 매거진에 남긴다.

## 테스트 계획

TDD 2단계에서 신규 테스트를 먼저 작성하고, 실패를 확인한 뒤 구현한다.

### 신규 테스트

1. 추천 토글
   - `post-likes.mjs`가 `requireViewer`를 사용한다.
   - 첫 추천은 `post_likes`를 insert하고 `likeCount`, `viewerLiked=true`를 반환한다.
   - 다시 추천하면 `post_likes`를 delete하고 `likeCount`, `viewerLiked=false`를 반환한다.
   - 추천 취소 후 재추천하면 다시 `viewerLiked=true`를 반환한다.

2. 공지 정렬
   - `posts.mjs` 목록 쿼리가 `is_notice desc`, `created_at desc` 순서로 정렬한다.
   - `admin-moderate`가 `pin_notice`, `unpin_notice`를 허용한다.

3. 카테고리와 말머리 필터
   - `category=review`가 `review`와 `event_review`를 함께 조회한다.
   - `reviewKind=tool`은 `review`만 조회한다.
   - `reviewKind=meeting`은 `event_review`만 조회한다.
   - 응답 `prefix`가 `[도구]`, `[모임]` 매핑을 따른다.

4. free 작성 거부
   - `validatePostPayload` 또는 create handler가 `postType='free'`를 거부한다.
   - `playground-compose`가 자유 기록 탭에서 submit 가능한 폼을 열지 않는다.

5. 페이지네이션
   - `posts.mjs`가 `limit=20`, `offset`을 적용한다.
   - `limit`이 20을 초과해도 20으로 제한한다.
   - 응답에 `hasMore`가 있다.

6. 자유 탭 잠금
   - `playground-list.js`가 `자유 기록🔒` 클릭 시 준비 중 빈 화면을 렌더링한다.
   - 자유 탭에서는 목록 API와 글쓰기 API를 호출하지 않는다.

7. 조회수 증가
   - `post-detail.mjs`가 본문 읽기 권한자의 visible 글 상세 요청에서 `view_count`를 증가시킨다.
   - 본문 읽기 권한이 없는 비공개 글 상세 요청에서는 `view_count`를 증가시키지 않는다.
   - hidden 또는 deleted 글의 404 응답에서는 조회수를 증가시키지 않는다.

8. 본인 글 삭제
   - 본인이 아닌 글 삭제는 403으로 거부한다.
   - 답변이 달린 질문 삭제는 400과 `"답변이 달린 질문은 삭제할 수 없어요"`로 거부한다.
   - 본인 글 삭제 성공 시 `posts.status='deleted'`로 soft delete한다.

9. 비공개 글 숫자 숨김
   - 본문 읽기 권한이 없는 비공개 글 목록 응답은 `viewCount=null`, `likeCount=null`을 반환한다.
   - 본문 읽기 권한이 없는 비공개 글 상세 응답은 `viewCount=null`, `likeCount=null`을 반환한다.
   - 프론트는 해당 숫자를 `-`로 표시하고 추천 버튼을 렌더링하지 않는다.

10. dist 참조 무결성
   - `build-public.test.mjs`가 신규 JS 파일의 `PUBLIC_FILES` 등록을 검증한다.
   - `public build includes every local src and href referenced by dist html` 테스트가 통과한다.

### 기존 테스트 유지

기존 42개 테스트는 유지한다. 특히 다음 검증은 깨지면 안 된다.

- `access-policy.test.mjs`: 비공개 질문 접근 정책
- `validators.test.mjs`: 한국어 사용자 메시지와 YouTube URL 검증
- `community-source.test.mjs`: YouTube ID 노출 제한, 답변 작성 흐름
- `build-public.test.mjs`: 공개 파일 allowlist와 dist 참조 무결성
- `tests/test_site.py`: 정적 HTML 필수 구조

### 실행 명령

`kalis_magic_playground/` 루트에서 실행한다.

```bash
npm test
npm run build
node scripts/check-dist-safety.mjs
python3 tests/test_site.py
```

최종 검증은 기존 `verify` 스크립트로 묶어 실행한다.

```bash
npm run verify
```

## 배포 계획

1. 신규 migration 파일을 작성한다.
2. 칼리형이 Supabase SQL Editor에서 migration SQL을 먼저 실행한다.
3. migration 성공 후 코드 변경을 배포한다.
4. Netlify 자동 빌드가 `dist`를 생성한다.
5. 배포 후 `playground.html`에서 다음을 smoke test한다.
   - 전체 탭 목록 로딩
   - 질문함 탭 목록 로딩
   - 리뷰 탭에서 `[도구]`, `[모임]` 노출
   - 자유 기록 잠금 화면
   - 상세 진입 시 조회수 증가
   - 로그인 후 추천, 취소, 재추천
   - 본인 글 삭제 성공
   - 답변 달린 질문 삭제 거부
   - 관리자 공지 고정과 해제

배포 순서는 반드시 migration 먼저, 코드 배포 나중이다.

## 미해결 없음 확인

- V2 범위는 게시판 허브 확장으로 확정했다.
- 배지 시스템은 전체 제외로 확정했다.
- 탭 구성은 `전체`, `질문함`, `리뷰`, `매거진`, `자유 기록🔒`로 확정했다.
- 리뷰 말머리는 새 `review_kind` 컬럼 없이 기존 `category`로 확정했다.
- 기존 `event_review` 글은 리뷰 탭 `[모임]`으로 노출한다.
- 자유 기록은 탭만 있고 작성 불가로 확정했다.
- 추천은 `post_likes` insert/delete 토글로 확정했다.
- 목록 번호 컬럼은 생략하고 말머리부터 시작한다.
- 본인 글 삭제는 허용하되, 답변이 달린 질문은 삭제하지 않는다.
- 조회수는 본문 읽기 권한자의 상세 진입 시 단순 증가로 확정했다.
- 비공개 글 비권한자 응답의 `viewCount`와 `likeCount`는 `null`로 반환한다.
- 비공개 질문 접근 제어는 변경하지 않는다.
- 신규 JS 파일은 `build-public.mjs` `PUBLIC_FILES`에 등록한다.
- 배포 순서는 Supabase migration 먼저, Netlify 코드 배포 나중으로 확정했다.
