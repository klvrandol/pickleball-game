# PICKLE COURT — 기본 주소 배포

최종 기본 주소: https://klvrandol.github.io/pickleball-game/
기존 미리보기: https://klvrandol.github.io/pickleball-game/doubles-preview/

## 확인한 원인과 실제 배포 구조

- `main`에는 PR #1을 통해 최신 단식·혼합복식·다국어 게임이 병합되어 있었지만, Pages 파일은 갱신되지 않았다.
- `gh-pages` 루트 index.html은 이전 단식 버전, doubles-preview/index.html은 최신 PICKLE COURT 타이틀이었다.
- 실제 배포는 `gh-pages`를 소스로 하는 GitHub 관리 워크플로 `pages build and deployment` (`dynamic/pages/pages-build-deployment`)였다. 이 설정을 유지한다.
- API 접근은 이 환경에서 403으로 제한되어, 공개 Actions 실행 메타데이터의 배포 브랜치와 워크플로 경로로 확인했다. Pages 설정 변경은 수행하지 않는다.

## 현재 구성

- Vite build/preview base: `/pickleball-game/`; 개발 서버 base: `/`.
- 원본 4종과 실행용 `*-sports.glb` 4종 유지. 실행용 모델은 BASE_URL을 사용하며 텍스처는 GLB에 내장되어 있다.
- `npm run build`의 dist 전체를 루트에 반영한다. HTML 한 개만 복사하지 않는다.
- `tools/publish-pages.mjs`는 기존 gh-pages 트리를 바탕으로 dist 파일을 추가/갱신한다. 기존 파일은 삭제하지 않고 `doubles-preview/`의 Git 트리 해시가 완전히 동일한지 검사한다.
- `.github/workflows/pages.yml`은 main push 시 설치·테스트·빌드·에셋 검사 및 artifact 보관만 수행한다. 실제 사이트 배포는 gh-pages push 후 GitHub 관리 Pages 워크플로가 수행한다.
- 배포 루트의 `deploy-info.json`에 소스 커밋, 이전 Pages 커밋, 보존한 preview 트리와 기본 경로를 기록한다.

## 명령

Node.js 24 권장:

```sh
npm ci
npm test
npm run build
node tools/check-pages-assets.mjs
node tools/check-pages-browser.cjs
```

브라우저 검사는 Playwright/Chromium이 설치된 개발 환경에서 실행한다. 실제 dist에서 모델·텍스처·타이틀·두 모드의 실제 서브 클릭·언어·재시작·새로고침을 검사한다. 승패 종료 경로는 같은 소스를 별도 임시 production 빌드로 만들어 테스트용 상태 접근과 알림 시계로 검사한다. 배포할 dist에 디버그 접근을 추가하지 않는다.

변경 사항을 커밋한 뒤 먼저 로컬 배포 미리보기를 검토한다:

```sh
node tools/publish-pages.mjs
```

실제 공개를 승인한 경우:

```sh
npm run publish:pages
```

이 명령은 원격 백업 태그를 먼저 생성한 후, 일반 fast-forward push로 gh-pages를 갱신한다. 강제 푸시나 브랜치 삭제는 하지 않는다. 소스가 미커밋 상태이면 중단한다. 동시에 다른 배포가 발생하면 push가 거절되어 덮어쓰지 않는다.

## 백업과 복구

- 기존 `singles-v1.0`, `v1.0.0` 태그는 변경하지 않는다.
- 공개 직전 gh-pages 커밋은 `pages-before-root-<이전커밋 앞 12자리>` 태그로 원격에 보관한다. 이 태그에 루트와 preview가 모두 포함된다.
- 첫 루트 전환 이전 커밋: `d4ffa0a042f2518d222bcf4e7495c1dacc444e44`; preview 트리: `e87cb969f9c48d7f206bad2c55736e617af9a0f0`.
- 복구도 이전 이력을 삭제하지 않고 새 커밋을 추가한다. 실제 복구 전 dry run으로 확인할 수 있다:

```sh
node tools/publish-pages.mjs --rollback pages-before-root-d4ffa0a042f2
node tools/publish-pages.mjs --rollback pages-before-root-d4ffa0a042f2 --publish
```

GitHub **Settings → Pages**는 기존 **Deploy from a branch → gh-pages → /(root)**를 유지한다. **GitHub Actions** 소스로 전환할 필요가 없다. 저장소는 이미 Public이다.

## 기존 검토 사항

게임 모델·물리·AI·규칙·카메라·다국어는 변경하지 않는다. 기존 Three.js 번들 크기 경고는 빌드 실패가 아니다. 에셋 이용 조건과 업로드 배포판의 미확인 사항은 `models-src/ASSET-LICENSE-REVIEW.md`에 그대로 기록되어 있으며, 이번 경로 변경을 라이선스 추가 검증 완료로 간주하지 않는다.

실제 GitHub.io 직접 접속이 환경 네트워크에서 차단되면 이를 실서비스 게임 오류로 보고하지 않는다. GitHub 관리 배포 성공 여부와 로컬에서 동일 배포 파일로 수행한 검증을 구분하여 보고한다.
