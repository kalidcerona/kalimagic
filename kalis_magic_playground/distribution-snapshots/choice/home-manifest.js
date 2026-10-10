// Home screen icon data. To change the artwork, copy new SVG files into ./home-icons/ and edit
// the file names below. Nothing else reads the artwork: the layout, the keypad digits and the
// user icon slots come from HOME_LAYOUT in logic.js. Each cell: row/col (zero based), file
// (home-icons/<file>.svg), name (label), digit (documentation only, the keypad position decides),
// hint (memory aid shown only in settings), kind 'folder' (taps do nothing), action 'notes' (opens the notes app on page 3), userSlot
// (a 0 cell the performer may replace with their own icon; until then it shows one of our own
// magic apps, drawn with the same squircle mask as photos: mask true). No cell ever shows a
// neutral placeholder or the word 앱, and no third party brand logo is bundled.
export const HOME_MANIFEST = {
  version: 3,
  iconDir: 'home-icons/',
  pages: [
    [
      {row: 0, col: 0, file: "f1", name: "지도", digit: 0, kind: "folder"},
      {row: 0, col: 1, file: "f2", name: "유틸", digit: 0, kind: "folder"},
      {row: 0, col: 2, file: "f3", name: "인터넷", digit: 0, kind: "folder"},
      {row: 0, col: 3, file: "f4", name: "은행", digit: 0, kind: "folder"},
      {row: 0, col: 4, file: "f5", name: "게임", digit: 0, kind: "folder"},
      {row: 1, col: 0, file: "z1", name: "시계", digit: 0},
      {row: 1, col: 1, file: "a1", name: "촛불노트", digit: 1, hint: "초 한 자루(I)"},
      {row: 1, col: 2, file: "a2", name: "고요호수", digit: 2, hint: "백조 목선이 2의 곡선"},
      {row: 1, col: 3, file: "a3", name: "굴려봐", digit: 3, hint: "주사위 눈 3개(대각선)"},
      {row: 1, col: 4, file: "z2", name: "메모", digit: 0},
      {row: 2, col: 1, file: "a4", name: "바람요트", digit: 4, hint: "돛대 세로, 돛 사선, 활대 가로가 4"},
      {row: 2, col: 2, file: "a5", name: "야구노트", digit: 5, hint: "홈플레이트 오각형(변 5개)"},
      {row: 2, col: 3, file: "a6", name: "달팽이네", digit: 6, hint: "달팽이 껍질과 목이 6"},
      {row: 2, col: 4, file: "z4", name: "설정", digit: 0},
      {row: 3, col: 0, file: "z5", name: "캘린더", digit: 0},
      {row: 3, col: 1, file: "a7", name: "기록장", digit: 7, hint: "ㄱ 모양 로고가 7의 윗부분"},
      {row: 3, col: 2, file: "a8", name: "모래시간", digit: 8, hint: "모래시계 두 삼각형이 8"},
      {row: 3, col: 3, file: "a9", name: "둥실풍선", digit: 9, hint: "풍선과 늘어진 끈이 9"},
      {row: 4, col: 0, file: "own-stopwatch.png", name: "스톱워치", digit: 0, userSlot: true, mask: true},
      {row: 4, col: 1, file: "z8", name: "녹음", digit: 0},
      {row: 4, col: 3, file: "own-release.png", name: "레리즈", digit: 0, userSlot: true, mask: true},
      {row: 5, col: 1, file: "own-aletheia.png", name: "ALETHEIA", digit: 0, userSlot: true, mask: true},
      {row: 5, col: 2, file: "own-tobira.png", name: "TOBIRA", digit: 0, userSlot: true, mask: true}
    ],
    [
      {row: 0, col: 0, file: "y1", name: "리마인더", digit: 0},
      {row: 0, col: 2, file: "f6", name: "생활", digit: 0, kind: "folder"},
      {row: 0, col: 3, file: "y2", name: "스토어", digit: 0},
      {row: 1, col: 0, file: "y3", name: "월렛", digit: 0},
      {row: 1, col: 1, file: "b1", name: "물한잔", digit: 1, hint: "물방울 하나"},
      {row: 1, col: 2, file: "b2", name: "집밥일기", digit: 2, hint: "나란한 젓가락 두 개(II)"},
      {row: 1, col: 3, file: "b3", name: "초록싹", digit: 3, hint: "새싹 잎 3장"},
      {row: 2, col: 1, file: "b4", name: "말판놀이", digit: 4, hint: "주사위 눈 4개"},
      {row: 2, col: 2, file: "b5", name: "파도타기", digit: 5, hint: "S자 파도가 5"},
      {row: 2, col: 3, file: "b6", name: "수다방", digit: 6, hint: "b 모양 말풍선이 6"},
      {row: 2, col: 4, file: "y4", name: "스마트홈", digit: 0},
      {row: 3, col: 0, file: "f7", name: "미디어", digit: 0, kind: "folder"},
      {row: 3, col: 1, file: "b7", name: "되돌이", digit: 7, hint: "부메랑 윤곽이 7"},
      {row: 3, col: 2, file: "b8", name: "눈사람", digit: 8, hint: "눈사람 두 원이 8"},
      {row: 3, col: 3, file: "b9", name: "문앞택배", digit: 9, hint: "세로 테이프(I) 옆 X자 테이프 = IX"},
      {row: 3, col: 4, file: "y5", name: "번역", digit: 0},
      {row: 4, col: 0, file: "own-usotsuki.png", name: "USOTSUKI", digit: 0, userSlot: true, mask: true},
      {row: 4, col: 2, file: "y11", name: "스캐너", digit: 0},
      {row: 4, col: 3, file: "own-asrai.png", name: "아스라이", digit: 0, userSlot: true, mask: true},
      {row: 5, col: 0, file: "own-alter.png", name: "ALTER", digit: 0, userSlot: true, mask: true},
      {row: 5, col: 1, file: "y10", name: "팁", digit: 0},
      {row: 5, col: 3, file: "own-memdeck.png", name: "멤덱 연습실", digit: 0, userSlot: true, mask: true}
    ],
    [
      {row: 0, col: 0, file: "z6", name: "파일", digit: 0},
      {row: 0, col: 1, file: "z10", name: "메일", digit: 0},
      {row: 1, col: 2, file: "y7", name: "노트", digit: 0, action: "notes"},
      {row: 1, col: 3, file: "z12", name: "연락처", digit: 0},
      {row: 2, col: 1, file: "y9", name: "나침반", digit: 0}
    ]
  ],
  dock: [
    { file: "zb", name: "웹브라우저" },
    { file: "z13", name: "전화" },
    { file: "z11", name: "카메라" },
    { file: "zg", name: "갤러리" },
    { file: "z14", name: "메시지" }
  ]
};

// A file name with an extension is used as it is, a bare code means home-icons/<code>.svg.
export function iconSrc(file, manifest = HOME_MANIFEST) {
  return manifest.iconDir + (file.includes('.') ? file : file + '.svg');
}

export function manifestFiles(manifest = HOME_MANIFEST) {
  const files = new Set();
  manifest.pages.forEach((cells) => cells.forEach((cell) => files.add(cell.file)));
  manifest.dock.forEach((entry) => files.add(entry.file));
  return [...files];
}
