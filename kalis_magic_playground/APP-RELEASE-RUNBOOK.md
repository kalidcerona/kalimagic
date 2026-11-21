# 앱 출시 핀 운영

최초 승인 기준은 통합 커밋 `6cf885581815e1b3c53491520ffd8e2aee09d0c7`이다. `scripts/build-public.mjs`의 `APP_RELEASE_ROOTS`가 개인판 14개(zz1–zz8, zz10–zz15)와 공유 스냅샷 14개를 지정한다. KAIROS 두 주소는 같은 스냅샷을 쓴다. 별도 출시 게임 magicshow·planbcafe와 전용 셸 TabataTimer·KanameCue는 기존 빌드 검사를 따른다.

## 승인된 앱 변경 반영

1. 검토한 전체 커밋 SHA를 SOURCE_SHA에 지정한다. Git 저장소에서 아래 명령으로 작업 사본을 만들고 검토한 핀 생성기를 사용한다. 최초 도입처럼 생성기가 해당 커밋에 없으면 검토한 생성기와 빌드 스크립트를 사본에 먼저 복사한다.
2. 두 후보가 일치하는지 확인한다. 기존 명세와 비교해 추가·삭제·변경된 경로 및 원본 내용을 검토한다. 숨은 파일과 빈 폴더도 포함한다. 승인한 후보만 작업 트리의 scripts/app-release-pins.json에 복사한다.

```sh
V=$(mktemp -d)
git archive "$SOURCE_SHA" | tar -xf - -C "$V"
cd "$V/kalis_magic_playground"
node scripts/app-release-check.mjs --candidate "apps-$SOURCE_SHA" > "$V/first.json"
node scripts/app-release-check.mjs --candidate "apps-$SOURCE_SHA" > "$V/second.json"
cmp "$V/first.json" "$V/second.json"
diff -u scripts/app-release-pins.json "$V/first.json"
```

## 배포 전

- Node 20에서 `npm run check:apps`로 승인 트리를 대조한다. `npm run build`도 dist 삭제 전에 같은 검사를 한다. 실패하면 표시된 경로의 원본과 변경 승인을 확인한다.
- 형제 개발 원본이 있는 환경에서 `npm run audit:app-masters`를 별도로 실행한다. CI에서 원본이 전부 없으면 경고와 함께 건너뛴다. 일부 누락 또는 내용 불일치는 실패한다.
- `npm test`, `python3 tests/test_site.py`, `python3 tests/test_reviews.py`, `CI=true npm run build`, `npm run check:dist`를 실행한다. 기준과 후보는 같은 잠금 파일·환경으로 빌드하고 전체 dist의 상대경로·크기·SHA-256 차이를 승인 내역과 대조한다.
- 벨·슬롯의 공개 베타 설정과 보호 도구 접근을 확인한다. 설치 기기에서 이전 캐시로 시작해 업데이트를 수락하고 재실행·오프라인 시작을 확인한다. 타바타는 완료 후 다시 시작 → 준비 → 시작 흐름도 확인한다.
