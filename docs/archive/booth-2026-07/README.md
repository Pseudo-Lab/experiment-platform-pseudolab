Status: archive
Archived: 2026-11-08
Source-Period: 2026-07 (12기 부스 준비 자료)

# Data Initiative · 12기 부스 자료

2026년 7월 가짜연구소 행사 부스를 위해 준비한 실험 플랫폼 소개 자료입니다. 데이터 수집·분석, 실험 설계·결과 비교, 서비스 운영·인프라를 하나의 실험 생태계로 설명합니다. Data Initiative의 12기 활동과 이후 실험 플랫폼 개발을 이어서 살펴볼 수 있도록 당시 최종 배포본과 상세 설명 자료를 보존합니다.

처음 볼 때는 **[통합 핸드아웃 PDF (4쪽)](booth-handout-combined.pdf)**를 읽으면 됩니다. 피치 1쪽과 데이터·실험·인프라 각 1쪽을 함께 담았습니다.

## 자료 목록

| 자료 | 열람·인쇄 | 편집·재사용 | 용도 |
| --- | --- | --- | --- |
| 통합 핸드아웃 | [PDF · 4쪽](booth-handout-combined.pdf) | [HTML 원본](booth-handout-combined.html) | 전체 소개를 한 번에 열람 |
| 부스 피치 | [PDF · 1쪽](booth-pitch.pdf) | 통합 HTML의 첫 페이지 | 실험 생태계와 협업 방향 소개 |
| 3축 핸드아웃 | [PDF · 3쪽](booth-handout-3axis.pdf) | 통합 HTML의 2~4페이지 | 데이터·실험·인프라 중 관심 축별 배포 |
| 실험 동작·개발 연동 가이드 | [PDF · 2쪽](experiment-platform-development-booth-guide.pdf) | [Markdown](experiment-platform-development-booth-guide.md) · [PPTX](experiment-platform-development-booth-guide.pptx) | Feature Flag, SDK/API, 노출·행동 기록과 결과 비교 |
| 서비스 운영·인프라 가이드 | [PDF · 2쪽](experiment-platform-infra-booth-guide.pdf) | [Markdown](experiment-platform-infra-booth-guide.md) · [PPTX](experiment-platform-infra-booth-guide.pptx) | 요청 처리, 데이터 저장, 자동 배포와 관찰·복구 |

통합본과 단독 PDF는 같은 내용을 서로 다른 배포 단위로 제공합니다. HTML은 폰트와 이미지를 포함한 독립 파일입니다. 내려받아 브라우저에서 열고, 인쇄 시 A4 세로·배율 100%·배경 그래픽 켜기·머리글/꼬리글 끄기를 사용합니다.

## 선정 기준과 보존 범위

- 원자료의 `iterations/after/README.md`가 피치와 3축 핸드아웃을 **“최종 · 두 버전 공존”**으로 명시합니다. 이 두 버전과 이를 묶은 통합본을 선정했습니다.
- 상세 가이드 2종은 원문에 **2026-07-23 기준, 수도콘 부스 설명 보조자료**로 명시된 완성본입니다.
- 이름만 바꾼 동일 PDF, `iterations/before`의 이전 시안, 인쇄 기획서, 생성 스크립트와 색상 시안은 제외했습니다.
- PDF·PPTX·HTML은 원본 바이트를 보존했습니다. 상세 Markdown은 보관 상태와 시점 안내만 덧붙이고 본문을 유지했습니다. 이 안내문은 아카이브를 위해 새로 작성했습니다.

## 현재 자료와 구분

이 자료는 **2026년 7월 당시 소개본**입니다. 이후 Iterglow로 정리된 제품명·SDK와 현재 기능, 운영 구조, 모집 상태를 설명하는 최신 기준 문서로 사용하지 않습니다. 본문의 A/B Test Agent와 공개 실험 데이터셋은 당시 지향점이며 구현 완료나 데이터 공개 완료의 증거가 아닙니다.

피치의 QR은 당시 **실험 플랫폼 프로젝트 관심 등록 폼**으로 연결됩니다. 2026-11-08에 연결을 확인했으며 원본 QR을 보존했습니다. 현재 참여 안내는 아래 팀 소개와 저장소 README를 확인하세요. 원자료에 남아 있던 일부 브랜드 보조색의 확정 여부는 이번 보관 작업에서 검증하지 않았습니다.

현재 맥락과 구현을 확인할 때는 다음 문서를 사용합니다.

- [Data Initiative 팀 소개·활동](https://pseudo-lab.github.io/experiment-platform-pseudolab/)
- [Iterglow 프로젝트 README](../../../README.md)
- [현재 기준 문서 인덱스](../../reports/_index.md)
- [실험 플랫폼 개념 가이드](../../guides/experiment_platform_concepts.md)
- [현재 SDK 사용 안내](../../../packages/sdk/README.md)
