# PICKLE COURT — GitHub Pages 배포 준비

## 현재 상태: 기술 준비 / 최종 공개 보류

- 저장소: `klvrandol/pickleball-game`, 기본 브랜치 `main`.
- 완성된 게임과 이번 준비 파일: `feature/doubles`. 원격 `main`은 이전 프로토타입이므로 바로 배포하면 안 된다.
- 시작 시 미커밋 변경 사항 없음. 기존 완성본을 빈 백업 커밋 `ce5a21e`와 주석 태그 `v1.0.0`으로 로컬 Git에 보존했다. 기존 `singles-v1.0`은 변경하지 않았다.
- 원격 저장소는 현재 이미 **Public**임을 익명 GitHub 페이지 메타데이터로 확인했다. 공개 전환을 수행하지 않았다.
- 이번 작업은 로컬 커밋·파일·빌드·테스트만 준비한다. 원격 푸시, main 병합, Pages 설정 변경, Actions 실행, gh-pages 갱신을 하지 않는다. 백업 태그도 아직 원격에 업로드하지 않는다.
- 최종 공개 전 **KayKit 업로드 파일의 원본 패키지 라이선스 증빙**이 필요하다. [검토 내역](models-src/ASSET-LICENSE-REVIEW.md)을 확인한다.

## 배포 주소와 경로

승인 후 공개 예상 주소: https://klvrandol.github.io/pickleball-game/

- 타이틀: `/pickleball-game/`
- 단식: `/pickleball-game/singles.html`
- 혼합복식: `/pickleball-game/doubles.html`
- 고지: `/pickleball-game/ASSET-CREDITS.md`

Vite의 build/preview base는 `/pickleball-game/`, 개발 서버 base는 기존 `/`다. 모델 로더는 `import.meta.env.BASE_URL`을 사용한다. 원본 4종과 실행용 `*-sports.glb` 4종을 보존하며, 텍스처는 GLB 내부에 있다. 경기장·이펙트는 코드로 생성하고 소리는 Web Audio로 합성한다.

## 로컬 검증

Node.js 24 권장. 프로젝트 폴더에서:

```sh
npm ci
npm test
npm run build
node tools/check-pages-assets.mjs
npm run preview
```

빌드 미리보기는 명령 창에 표시되는 서버의 `/pickleball-game/` 경로로 연다. 기본 포트이면 `http://localhost:4173/pickleball-game/`다. 개발은 기존대로 `npm run dev`를 사용한다.

선택적 브라우저 테스트 (Playwright 및 Chromium이 설치된 개발 환경):

```sh
node tools/check-pages-browser.cjs
```

- 준비된 dist를 직접 제공하여 하위 경로, 원본/실행용 GLB, 내장 텍스처 로드, 콘솔·네트워크 오류, 타이틀, 언어 저장/전환, 두 모드의 실제 서브 클릭·재시작·새로고침·메뉴 복귀를 검사한다.
- 경기 종료 양쪽 경로는 동일한 소스를 별도 임시 production 빌드로 만들어 테스트 전용 상태 접근과 알림 시계로 검사한다. 실제 점수/서브/폴트 엔진을 호출한다. dist와 게임 소스에는 디버그 접근을 추가하지 않는다. 사람이 11점까지 직접 플레이한 테스트로 보고하지 않는다.
- 테스트 임시 빌드는 끝나면 삭제한다. 이 스크립트는 업로드나 배포를 하지 않는다.
- `CHROMIUM_PATH`로 브라우저 경로를 지정할 수 있다. 4301/4302 포트가 비어 있어야 한다.

## 이번 작업의 실제 검증 결과

- `npm run build`: 성공. 기존 Three.js 공유 번들 크기 경고만 남음.
- `npm test`: 132개 통과, 실패/건너뜀 없음.
- `node tools/check-pages-assets.mjs`: HTML 진입점 4개, GLB 10개, 내장 텍스처 8개, 원본 바이트 및 라이선스 고지 보존 확인.
- `node tools/check-pages-browser.cjs`: 배포 하위 경로의 실제 dist에서 두 모드 시작, 실제 클릭 서브, 한/영 전환과 저장, 재시작, 새로고침, 메뉴 복귀 통과. 별도 임시 production 빌드에서 양쪽 승패 종료, 최종 점수, 알림 번역, 재경기·메뉴 복귀 통과.
- 마지막 브라우저 검사: 콘솔 오류 0, 실패한 리소스 요청 0, HTTP 오류 0. 기본 favicon.ico 404는 각 HTML의 BASE_URL 기반 SVG 아이콘 연결로 수정함.
- 실제 배포 dist에는 테스트 상태 접근이 포함되지 않음을 확인함.
- 개발 base `/` 및 실제 개발 서버의 `/`, `/models/Ranger-sports.glb` HTTP 200 확인. production base `/pickleball-game/` 확인.
- 모델·텍스처·물리·AI·카메라·타격 보조 소스는 백업 태그와 동일함. 바뀐 런타임 코드는 모델 URL 처리뿐이며 HTML에는 탭 아이콘 경로만 추가함.
- 워크플로 YAML과 수동 실행/기본 false/브랜치 가드는 로컬 검사함. GitHub Actions 서버 실행 및 실제 Pages 공개 검증은 승인 전이므로 **미실행**.

## 최종 승인 후에만 수행할 절차

1. KayKit 모델을 확보한 ZIP의 원본 LICENSE와 출처/팩 버전을 확인하고 검토 문서의 미확인 상태를 갱신한다.
2. 준비된 변경 사항과 백업 커밋·태그를 검토한다. 승인 후 `feature/doubles`와 `v1.0.0`을 원격에 올리고, 완성본을 기본 브랜치 `main`에 반영한다. 이번 작업에서는 이 단계를 수행하지 않는다.
3. 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택한다. 저장소는 이미 Public이므로 다시 공개 전환할 필요가 없다. 상태가 달라졌다면 무료 계정에서는 Public 저장소인지 확인한다.
4. **Settings → Environments → github-pages**에 배포 브랜치 제한이 있다면 `main`을 허용한다. 필요하면 소유자 승인자를 지정할 수 있다.
5. **Actions → Prepare or publish PICKLE COURT Pages → Run workflow**, 브랜치는 `main`을 선택한다. 이 버튼은 workflow 파일이 기본 브랜치에 반영된 뒤에 표시된다.
6. 우선 `publish`를 **체크하지 않고** 실행하면 설치·테스트·빌드·dist 검증·Pages artifact 보관만 수행한다. 공개하지 않는다.
7. 최종 공개를 승인했을 때만 `publish`를 **체크하고** 수동 실행한다. 성공 후 예상 주소에서 모델, 언어, 두 모드를 확인한다.

워크플로는 push/PR/tag 이벤트로 실행되지 않는다. `main` 가드, 기본 false인 publish 입력, deploy job의 Pages/OIDC 권한으로 배포 단계를 분리했다. 사용한 GitHub 공식 Actions는 확인한 커밋 SHA로 고정했다. configure-pages의 자동 enablement는 켜지 않는다.

새 Pages artifact를 배포하면 기존 Pages 사이트 내용은 해당 dist로 대체된다. 기존 `gh-pages` 브랜치/커밋은 삭제하지 않지만 과거 `/doubles-preview/` URL의 계속 제공은 이번 루트 배포 artifact에 포함되어 있지 않다. 이 URL 유지가 필요하다면 최종 승인 전에 호환 경로를 별도로 준비해야 한다.

## 승인 전 해결할 항목

- 업로드 KayKit 모델의 정확한 원본 배포판과 라이선스 증빙. 특히 Ranger는 확인한 공식 무료 저장소에 없다.
- 기본 브랜치 main에 완성본을 반영할 승인. 현재 main은 과거 버전이다.
- 소유자가 직접 Pages Source를 GitHub Actions로 설정하고, 최종 공개를 승인할 것.

기존 Three.js 공유 번들 500 kB 초과 경고는 빌드 실패가 아니다. 기존 조작감 보존을 위해 이번에는 렌더러나 청크 구조를 바꾸지 않았다.
