Status: active
Last-Validated: 2026-11-15

# 서버 간 접근 판정 API

`POST /api/v1/access/decide`는 연동 서비스의 서버가 사용자와 요청 경로에 대한 접근 정책을 확인하는 API입니다. 사용자 인증 자체는 호출 서비스의 책임입니다. 프로젝트 공개 SDK 키가 아닌 [서버 credential](project-access.md)을 사용합니다.

## 요청·응답

```http
POST /api/v1/access/decide
Authorization: Bearer <SERVER_CREDENTIAL>
Content-Type: application/json
```

```json
{
  "user_id": "verified-user-id",
  "flag_key": "content-access",
  "route": "/members/content"
}
```

성공 또는 정책 거절은 HTTP 200으로 반환합니다.

```json
{
  "allow": true,
  "access_mode": "public",
  "reason": "allowed_public"
}
```

| 항목 | 계약 |
| --- | --- |
| `access_mode` | `private`, `committee`, `public` |
| `reason` | `not_authenticated`, `access_mode_private`, `not_committee`, `allowed_committee`, `allowed_public`, `evaluation_error` |
| HTTP 401 | 서버 Bearer token 누락·형식 오류·인증 실패 |
| HTTP 422 | 요청 스키마 오류 |

호출 서비스는 timeout·비200·잘못된 JSON·알 수 없는 enum·`allow=false`를 모두 접근 거절로 처리합니다. 이 API는 전달한 `user_id`의 신원 진위를 별도로 인증하지 않으므로 서비스에서 확인한 식별자를 전달해야 합니다.

## 정책 설정

같은 프로젝트에 속하는 enabled·비보관 feature flag의 payload를 평가합니다. 다음은 로그인 사용자의 특정 경로 접근을 허용하는 예입니다.

```json
{
  "access_mode": "public",
  "routes": ["/members/content"]
}
```

- `private`: 거절.
- `public`: `user_id`가 있는 요청의 접근 허용. 익명 전체 공개라는 의미가 아님.
- `routes`: 생략 가능. 존재하면 문자열 배열이어야 하며 요청의 route와 정확히 일치해야 함.
- 누락·다른 프로젝트·비보관 조회 실패·잘못된 설정·저장소 오류: 거절. disabled flag도 거절.

`committee`와 `committee_segment_id`는 기존 manual segment 기반 allowlist 계약입니다. 명칭은 현재 API enum이며 특정 서비스의 고정 사용자 역할을 새로 정의하는 기능은 아닙니다. 기존 공유 세그먼트가 설치 전역에 속하므로 **소유 계정이 연결된 프로젝트에서는 현재 committee 모드를 거절**합니다. 범용 프로젝트별 사용자 속성·권한 모델로 확대된 기능으로 안내하지 않습니다.

## 서버에서의 처리

1. 자신의 서비스에서 사용자 인증 및 신뢰할 식별자 확인.
2. 서버 secret 저장소의 credential로 API 호출.
3. HTTP 상태·JSON·응답 enum 검증.
4. 명시적 허용일 때만 대상 기능 제공.

브라우저에 서버 credential을 전달하거나 실패 시 로컬 기본 허용으로 우회하지 않습니다. 관리 API나 SDK variant 판정의 대체 경로로 사용하지 않습니다.

계약 근거: [요청·응답 스키마](../../backend/app/schemas/access.py), [인증 dependency](../../backend/app/api/deps.py), [판정 서비스](../../backend/app/services/access.py).
