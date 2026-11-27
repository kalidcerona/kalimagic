# 앱 출시 핀 운영

공개 정본은 추적되는 `distribution-snapshots/` 17개다. `scripts/build-public.mjs`의 `APP_RELEASE_ROOTS`와 출시 핀은 이 정본만 검증한다. KAIROS 두 주소는 같은 스냅숏을 쓴다. 별도 출시 게임 magicshow·planbcafe와 전용 셸 TabataTimer·KanameCue는 기존 빌드 검사를 따른다.

개인 ZZ 14개는 배포 입력에서 제외했다. 개인 원본·테스트·라이선스는 제거 전 커밋 `45105a7cf753f1bf15facc37608602f92fadbda1`에서 복구할 수 있다. 형제 개발 원본, 로컬 zz9와 Android magic-deqode는 별도 소유이며 이 배포에서 읽거나 변경하지 않는다.

공개판 수정은 정본에 직접 반영하고 변경 파일과 출시 핀을 함께 검토한다. `friend-builds.mjs list`는 정본 위치를 표시한다. 기존 11종의 `generate`·`--write`, 일반 `compare`와 `build-public.mjs --promote-unlock` 명령은 종료했다. 신규 공개판 asrai·alter·uramichi만 명시한 비공개 원본으로 생성할 수 있다. 자기 자신과 비교하는 재생성 검사는 사용하지 않는다. 출시 핀을 자동 갱신하지 않으며 정상 빌드에는 형제 체크아웃이 필요 없다.

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
- `npm run check:sources`로 공개 정본을 독립된 승인 핀과 대조한다. 기존 `npm run audit:app-masters`도 같은 검사를 실행한다. 형제 원본 누락을 이유로 검사를 건너뛰지 않는다.
- `npm test`, `python3 tests/test_site.py`, `python3 tests/test_reviews.py`, `CI=true npm run build`, `npm run check:dist`를 실행한다. 기준과 후보는 같은 잠금 파일·환경으로 빌드하고 전체 dist의 상대경로·크기·SHA-256 차이를 승인 내역과 대조한다.
- 벨·슬롯의 공개 베타 설정과 보호 도구 접근을 확인한다. 설치 기기에서 이전 캐시로 시작해 업데이트를 수락하고 재실행·오프라인 시작을 확인한다. 타바타는 완료 후 다시 시작 → 준비 → 시작 흐름도 확인한다.

## ZZ 전환 배포 조건

종료 SW는 `legacy-bridges/zzN/sw.js`로 만들고 Netlify가 기존 `/zzN/sw.js`에 JavaScript·no-store 응답을 제공한다. 14개 기존 경로는 대응 공개판에 301로 연결하며 옛 manifest·폐기 자원은 404로 응답한다. 신규 공개판 3종과 승인된 안정성 개선 파일만 핀을 갱신한다. RELEASE의 HITSUZEN 연결도 정본에서 공개 주소로 정규화한다.

배포 전 기기별 백업·복원, 운영자 15개 공개 주소(14종과 KAIROS classic) 권한, 구 PWA 온라인 전환과 새 설치·오프라인 시작을 확인한다. 다른 앱의 로그인·캐시·사진 보존과 실제 호스트의 상태·Location·MIME을 확인한다. 이 확인과 운영자의 별도 push·배포 승인 전에는 운영 전환을 실행하지 않는다. 실패 시 직전 승인 배포와 redirect로 복귀하고 사용자 백업·승인 행을 보존한다.

## 신규 공개판 3종 재생성

기존 개인 원본의 고정 커밋을 별도 임시 폴더에 풀고 원본 위치를 명시한다. 대상 스냅숏 자체를 입력으로 사용하면 실패한다. `--write`는 검토한 출력으로 정본을 교체할 때만 사용하고 그 뒤 출시 핀을 별도로 검토한다. 일반 CI는 생성기를 실행하지 않고 체크인된 정본만 읽는다.

```sh
mkdir .retirement-sources
git -C .. archive 45105a7cf753f1bf15facc37608602f92fadbda1 kalis_magic_playground/zz8 kalis_magic_playground/zz10 kalis_magic_playground/zz15 | tar -xf - -C .retirement-sources
node scripts/friend-builds.mjs generate asrai --source .retirement-sources/kalis_magic_playground/zz8 --out .retirement-check/asrai
node scripts/friend-builds.mjs generate alter --source .retirement-sources/kalis_magic_playground/zz10 --out .retirement-check/alter
node scripts/friend-builds.mjs generate uramichi --source .retirement-sources/kalis_magic_playground/zz15 --out .retirement-check/uramichi
```

저장 키·캐시 이름은 `friend-` 접두사로 분리하고 공개판의 공연 화면 밖에서는 wake lock을 해제한다. 설정 커스텀·로컬 미리보기는 제공하지 않는다. 각 공개 셸은 빌드 때 기존 권한 확인을 삽입하고 SW가 캐시한 HTML에서도 이 확인을 유지한다. URAMICHI의 QR 디코더 라이선스를 함께 보존한다.
