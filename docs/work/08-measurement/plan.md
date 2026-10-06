# 판정 단계별 퍼널 측정 구현 계획

상태: 승인

**Goal:** 체크 완료 때 판정 단계를 GA 사용자 속성으로 저장하고, `make meta-report`에 사람 수 기준 퍼널과 판정 단계별 표를 더한다.

**Spec:** [spec.md](spec.md)

## Global Constraints

- 사용자 속성 이름은 `check_level`, 값은 `judge()` 결과(`strong` / `moderate` / `weak`) 그대로다.
- 메타 픽셀 호출은 바꾸지 않는다. 응답은 해시 밖으로 보내지 않는다.
- 리포트는 GA 조회가 하나라도 실패하면 지금처럼 전체를 멈춘다. 단, 판정 단계별 조회만은 실패해도 "아직 없다"로 쓰고 계속한다.
- 레이어: `app → components → lib → data`. 분석 호출은 `components/analytics/track.ts`에만 둔다.
- 작업 단위마다 커밋 1개. 푸시 전 `make gate` 통과.

## 작업 단위와 병렬성

| Task | 내용 | 소유 파일 | 담당 | 의존 | 병렬 |
|---|---|---|---|---|---|
| 1 | 사용자 속성 저장 | `frontend/src/components/analytics/track.ts` | frontend-implementer | 없음 | 2와 병렬 |
| 2 | 리포트 퍼널·단계별 표 | `reporting/src/ga4.ts`, `report.ts`, `index.ts`, `report.test.ts` | 메인 세션 | 없음 | 1과 병렬 |
| 1-1 | 공유받은 리포트 속성 | `frontend/src/components/analytics/track.ts`, `frontend/src/components/sleep/report-view.tsx` | frontend-implementer | 1 | 2-1과 병렬 |
| 2-1 | 리포트 단계별 표에 출처 나누기 | `reporting/src/ga4.ts`, `report.ts`, `report.test.ts` | 메인 세션 | 2 | 1-1과 병렬 |
| 3 | 문서 | `docs/architecture.md`(분석 흐름이 있으면), `docs/meta-ads/strategy.md`(볼 숫자) | 메인 세션 | 1·2 | - |
| 4 | GA 맞춤 측정기준 등록 | GA 관리자 화면 | 사용자 | 1 배포 후 | - |

### Task 1: 사용자 속성 저장

- `track()`이 `check_complete`를 보낼 때, 이벤트보다 먼저 `gtag("set", "user_properties", { check_level: level })`을 부른다.
- 다른 이벤트는 바꾸지 않는다.
- 검증: `pnpm --dir frontend test`, 타입 체크, 로컬에서 체크를 끝낸 뒤 `window.dataLayer`에 `set user_properties`가 이벤트보다 먼저 들어갔는지 확인.

### Task 1-1: 공유받은 리포트 속성

- `track.ts`에 사용자 속성을 저장하는 함수를 둔다. `check_complete`는 `{ check_level, report_source: "self" }`를 저장한다.
- `report-view.tsx`: 공유받은 리포트(`shared`)를 열고 해시가 유효하면, 해시에서 계산한 판정 단계로 `{ check_level, report_source: "shared" }`를 한 번 저장한다. 해시 자체는 보내지 않는다.
- 검증: `make fe-check`, 로컬에서 공유 링크를 연 뒤 `window.dataLayer` 확인.

### Task 2: 리포트 퍼널·단계별 표

- `ga4.ts`
  - 사람 수 조회 함수: 지표 `totalUsers`, 측정기준 `sessionManualAdContent`(필요하면 `customUser:check_level`). 조건별로 세 번 조회한다.
    - 체크 완료: `eventName = check_complete`
    - 병원 목록 진입: `eventName = page_view` 그리고 `pagePath = /clinics`
    - 병원 연결: `eventName in [clinic_click, clinic_call]` (측정기준에 이벤트 이름을 넣지 않아 한 사람이 한 번 잡힌다)
  - 판정 단계별 조회는 실패하면 `null`을 돌려준다.
- `report.ts`
  - 순수 함수로 사람 수 행을 합치고, 퍼널 표와 판정 단계별 표를 마크다운으로 만든다. 단계 이름은 리포트 화면과 같은 말(검사 권유 / 상담 권유 / 신호 약함 / 단계 없음)을 쓴다.
  - 기존 이벤트 수 표 위에 "이벤트 수 기준"을 적는다.
- `index.ts`: 세 조회를 기존 조회와 함께 기다린 뒤 리포트에 넘긴다.
- `report.test.ts`: 퍼널 표, 단계별 표, 단계별 조회가 `null`일 때의 문구를 테스트한다.
- 검증: `make reporting-check`.

### Task 2-1: 단계별 표에 출처 나누기

- 판정 단계별 조회의 측정기준을 `customUser:check_level`, `customUser:report_source` 두 개로 한다. 줄 이름은 "검사 권유 · 직접 체크", "검사 권유 · 공유받음"처럼 쓴다.
- 검증: `make reporting-check`.

### Task 3: 문서

- `docs/meta-ads/strategy.md`의 "볼 숫자"에 판정 단계별 병원 연결률을 더한다.
- 분석 흐름을 적은 문서가 있으면 사용자 속성을 더한다.

### Task 4: GA 맞춤 측정기준 등록 (사용자)

- GA 관리자 → 맞춤 정의 → 맞춤 측정기준 만들기 → 범위 "사용자", 사용자 속성 `check_level`, `report_source` 두 개.
- Task 1 배포 후, 2차 광고 전에 한다.

## 검증 기준

| 기준 | 방법 |
|---|---|
| 체크 완료 시 `check_level` 사용자 속성이 이벤트보다 먼저 설정된다 | 로컬 브라우저 `window.dataLayer` 확인 |
| 픽셀 호출은 그대로다 | 코드 diff 확인 |
| 리포트에 사람 수 기준 퍼널(합계, 소재별)이 나온다 | `report.test.ts` |
| 판정 단계별 표가 나오고, 조회 실패 시 리포트가 멈추지 않는다 | `report.test.ts` |
| 게이트 통과 | `make gate` |
