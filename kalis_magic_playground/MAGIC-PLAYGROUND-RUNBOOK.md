# 마술 놀이터 운영 런북

## 환경변수

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `MAGIC_PLAYGROUND_ADMIN_EMAILS`

## 출시 전 점검

- `npm test` 통과
- `npm run build` 후 `dist/`에 private docs 없음
- Supabase Google provider redirect URL 설정
- admin/kali profile role 설정
- 비공개 질문 public API 노출 수동 확인

## 사고 대응

비공개 데이터 노출 의심:

1. Netlify functions를 이전 deploy로 rollback한다.
2. Supabase secret key를 rotate한다.
3. `moderation_events`와 Netlify function logs를 확인한다.
4. 노출 가능성이 있는 질문자에게 공지한다.

문제 글:

1. admin inbox에서 hide 처리한다.
2. 필요하면 delete 처리한다.
3. 반복 사용자는 role/계정 제한을 검토한다.
