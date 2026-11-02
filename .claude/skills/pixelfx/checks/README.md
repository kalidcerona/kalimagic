# 실게임 검사

기존 게임 파일을 수정하지 않고 설치된 시트를 재생합니다. 이 검사들은 화면 실행이 가능한 리더 환경에서 수행합니다.

## LOVE

```sh
bash .claude/skills/pixelfx/checks/love-in-game.sh <cafe-game-dir> coin-spin /tmp/pixelfx-love.png
```

임시 폴더의 src/assets는 실제 게임을 가리키고 main/conf는 사본입니다. 원본 conf 실행 후 저장 ID를
`pixelfx-check`로 강제합니다. 실제 `love.load`를 호출한 다음 설치된 update/draw를 감싸므로 타이틀 화면과
효과가 함께 재생됩니다. 약 3초 뒤 screenshot과 프레임 변화 수를 출력합니다. 30초 제한이 있습니다.
스크린샷은 LOVE의 `pixelfx-check` 저장 폴더를 거쳐 요청 경로로 복사됩니다. 출력 파일은 새 경로여야 합니다.
게임이 추가 루트 파일을 요구하도록 바뀌면 임시 폴더 구성을 검토해야 합니다. 검사 실패를 성공으로 간주하지 않습니다.

## 웹

```sh
node .claude/skills/pixelfx/checks/web-in-game.mjs <web-game-dir> magic-circle-cast /tmp/pixelfx-web.png
```

이 명령은 실행할 로컬 서버 및 `~/.local/bin/browse` 명령을 출력합니다. 출력된 두 터미널 단계를 실행합니다.
실제 index.html을 연 뒤 classic script를 주입하고 화면 위 캔버스에서 3초 재생합니다. 프레임 증가와
알파가 0이 아닌 픽셀을 검사한 뒤 마지막 화면을 유지합니다. `pass:true`, `changes>1`, `nonempty:true` 및
스크린샷을 확인합니다. 검사는 localStorage, IndexedDB, 저장 코드, service worker를 조작하지 않습니다.
페이지를 여는 것 자체의 게임 저장 동작은 발생할 수 있습니다. 포트 충돌 시 네 번째 인자로 다른 포트를 지정합니다.
브라우저 검사 후 로컬 서버를 종료합니다. 스크린샷 경로에는 기존 파일이 없는 경로를 사용합니다.

## 게임 연결

LOVE는 `require("src.core.pixelfx_sheet").new("coin-spin", x, y)`로 인스턴스를 만들고 update/draw/done을 호출합니다.
웹은 `pixelfx-sheet.js` classic script 로딩 후 `await PixelFxSheet.load("assets/fx/magic-circle-cast")` 결과의
`new(x, y)`를 사용합니다. dt는 초 단위, pivot은 프레임 내부 픽셀 좌표입니다. 루프 효과는 done이 항상 false입니다.
이번 설치는 기존 main.lua, index.html, manifest, service worker 목록을 변경하지 않습니다. 실제 이벤트 연결과
오프라인 캐시 등록은 별도 작업입니다. 클라우드에서는 exporter의 `--game`에 실제 게임 경로를 지정합니다.
