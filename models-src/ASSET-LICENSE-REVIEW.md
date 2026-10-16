# 배포 전 에셋 라이선스 검토 — 2026-10-16

## 확인된 사항과 남은 증빙

| 리소스 | 확인한 라이선스 / 근거 | 출처 표시 | 공개 전 상태 |
| --- | --- | --- | --- |
| KayKit Adventurers **공식 배포팩** | 공식 GitHub LICENSE.txt: CC0, 개인·교육·상업적 사용 허용 | 의무 없음, 제작자 표시는 권장 | 팩의 이용 조건 확인 완료 |
| 업로드된 Barbarian/Rogue/Mage 원본 및 스포츠 파생본 | 해당 이름은 공식 무료팩에 존재하나, 업로드 GLB는 공식 현재 파일과 해시·내장 텍스처·메시 구성이 다름 | 원본 팩의 조건에 따름 | 정확한 배포판/원본 LICENSE 증빙 필요. 재출력 또는 다른 버전일 수 있으며 차이 자체가 위반을 뜻하지는 않음 |
| 업로드된 Ranger 원본 및 스포츠 파생본 | 확인한 공식 무료 GitHub 배포팩에는 Ranger.glb가 없음 | 원본 팩의 조건 확인 필요 | **정확한 다운로드 출처·팩 이름과 원본 LICENSE.txt 확인 필요** |
| Quaternius athlete.glb | 포함된 2019 원본 Blender 파일과 보관소의 팩 LICENSE: CC0 1.0 Universal, 현재 보관소 원문도 재확인 | 의무 없음 | 무료·상업 배포 및 수정 가능 |
| Three.js 및 addons | 설치된 three 패키지의 MIT LICENSE 원문 | 저작권·MIT 고지 보존 필요 | public/licenses/THREE-LICENSE.txt 포함 |
| Vite 생성 런타임 헬퍼 | 설치된 Vite 패키지의 MIT 및 포함 고지 | 해당 고지 보존 | public/licenses/VITE-LICENSE.md 포함 |
| TypeScript, @types/three | 개발 전용 의존성, 브라우저 결과물에 라이브러리로 포함되지 않음 | 빌드 도구를 별도로 재배포할 경우 해당 패키지 고지 확인 | 게임 실행에 외부 요청 없음 |
| SD 시험 모델, 코트·공원·패들·이펙트 | 저장소 코드로 생성한 자체 콘텐츠 | 외부 에셋 출처 없음 | 기존 파일 유지 |
| 효과음, 폰트 | Web Audio 합성; 시스템 폰트 참조 | 외부 음원·폰트 파일을 배포하지 않음 | 별도 음원 다운로드 없음 |

## 공식 근거

- KayKit 공식 저장소: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- 고정 확인 커밋: `672074b73ba276876a19e8816ecdc5241817ab47`
- 공식 원문: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/672074b73ba276876a19e8816ecdc5241817ab47/LICENSE.txt
- 보존 사본: `public/licenses/KAYKIT-ADVENTURERS-LICENSE.txt`
- 공식 원문은 personal / educational / commercial 사용 허용, credit not mandatory라고 명시함.
- 제작자 itch.io 페이지는 이 클라우드의 네트워크에서 HTTP 403으로 열리지 않았음. 접근 권한을 확장해도 동일하여 공식 GitHub 원문을 확인함.
- Quaternius 고정 보관소 LICENSE: https://github.com/beep2bleep/FreeAssetsByKenneyNLandQuaternius/blob/dea756baf3b3a4889d8c245e456a4791f961578a/FreeModels%20by%20Quaternius%5BPatreon%5D/License.txt
- 기존 Quaternius 포함 고지: `models-src/QUATERNIUS-LICENSE.txt`와 `public/licenses/QUATERNIUS-LICENSE.txt`.

## 파일 보존 및 공개 전 확인

`asset-checksums-v1.0.0.json`에 원본·공개 복사본·스포츠 파생본·기존 athlete 모델의 SHA-256을 기록했다. 네 캐릭터의 저장소 루트 업로드와 public 원본 복사본은 각각 바이트가 동일하다. 어떤 모델이나 텍스처도 교체·삭제하지 않았다. 스포츠 GLB에도 텍스처가 내장되어 별도 이미지 URL이 필요하지 않다.

공식 팩의 CC0 확인과 업로드 파일의 출처 확인은 별개다. 기존 문서의 KayKit CC0 표기는 출처 주장으로 보존하되, 그것만으로 다른 배포판의 파일까지 검증 완료라고 판단하지 않는다. 원래 받은 ZIP의 LICENSE.txt와 다운로드 URL/팩 버전을 확보해 현재 파일에 적용되는 조건을 대조한 뒤 공개를 승인해야 한다. 확인 전에는 이 릴리스를 라이선스 검토 완료로 표시하지 않는다.

이 작업에서는 기존 공개 사이트를 변경하거나 새 배포를 실행하지 않았다. 게임 자체 코드의 라이선스도 새로 지정하지 않았다.
