# pixelfx 고정 버전

- 원본: https://github.com/patch-gg/pixelfx
- 커밋: `a84159688af3ca37a4be05a0d422b94451b2e24e`
- 버전: `0.3.0`
- 제외: `gallery/`, 그 안의 Patch Pixel 폰트, README 미디어, `package-lock.json`, `tools/build-gallery.mjs`, `tools/serve.mjs`.
- 유지: `src/core/font.js`의 MIT 비트맵 글리프. Patch Pixel과 별개입니다.
- `vendor.sha256`은 제공된 vendor 사본 전체의 SHA-256 목록입니다. 이번 작업에서 원격 커밋과 재대조하지 않았습니다.

## 의도적인 갱신 절차

1. 갱신 작업 범위를 승인받고 별도 작업 디렉터리에 원본의 명시적인 커밋을 체크아웃합니다.
2. LICENSE와 NOTICE 변경을 검토하고 위 제외 항목 없이 vendor를 교체합니다. 일반 실행 중에는 vendor를 수정하지 않습니다.
3. 버전, 커밋, 고지 파일을 갱신하고 정렬된 전체 파일 목록으로 `vendor.sha256`을 재생성합니다.
4. `node scripts/check-skill.mjs`, 두 엔진 export, 구문 검사와 실게임 검사를 수행합니다.
5. 변경된 해시와 시각 결과를 검토한 뒤 리더가 커밋합니다.
