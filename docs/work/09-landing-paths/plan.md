# 랜딩 재설계와 당사자·배우자 경로 구현 계획

상태: 승인

**Goal:** 랜딩을 약속 + 첫 질문으로 다시 짜고, 경로(`self` / `partner`)에 따라 질문·리포트 문구를 바꾸고, 경로를 GA 사용자 속성으로 잰다.

**Spec:** [spec.md](spec.md) · 화면: [ux-spec](../../ux-spec.md)

## Global Constraints

- 경로 타입: `type Role = "self" | "partner"`. 쿼리 이름 `for`. 값이 없거나 잘못되면 질문 화면은 `/`로 보내고, 리포트는 `partner`로 연다.
- 판정 기준(`judge()`, `STRONG_QUESTIONS`, `MODERATE_MIN`), 질문 항목·순서·`id`, 해시 형식(v2)은 바꾸지 않는다.
- 경로별 문구는 `lib/sleep-check.ts`에 한 번만 정의한다. 컴포넌트는 `role`을 받아 문구를 고르기만 한다.
- 분석 호출은 `components/analytics/track.ts`에만 둔다. 증상 답은 보내지 않는다. 메타 픽셀 호출은 바꾸지 않는다.
- 글자 16px 이상, 터치 48px 이상, 원시 색상값 금지(`DESIGN.md`). 노랑 주요 버튼은 화면당 하나.
- 레이어: `app → components → lib → data`.
- 작업 단위마다 커밋 1개. 푸시 전 `make gate` 통과.

## 작업 단위와 병렬성

| Task | 내용 | 소유 파일 | 담당 | 의존 | 병렬 |
|---|---|---|---|---|---|
| 1 | 경로별 문구와 타입 | `frontend/src/lib/sleep-check.ts`, `sleep-check.test.ts` | 메인 세션 (`lib`은 공통 파일) | 없음 | 4와 병렬 |
| 2 | 랜딩 다시 짜기, `/c/*` 삭제 | `components/sleep/landing.tsx`, `app/page.tsx`, `app/c/` 삭제, `components/analytics/track.ts`(역할 속성) | frontend-implementer | 1 | 3과 병렬 |
| 3 | 질문·리포트 경로 반영 | `components/sleep/check-flow.tsx`, `app/check/page.tsx`, `components/sleep/report.tsx`, `report-view.tsx`, `app/r/page.tsx` | frontend-implementer | 1 | 2와 병렬 (track.ts는 2가 소유. 3은 호출만) |
| 4 | 리포트 경로별 퍼널 | `reporting/src/ga4.ts`, `report.ts`, `index.ts`, `report.test.ts` | 메인 세션 | 없음 | 1과 병렬 |
| 5 | e2e·접근성 | `frontend/e2e/check-flow.spec.ts`, `frontend/e2e/a11y.spec.ts` | frontend-implementer | 2, 3 | - |
| 6 | 문서 | `DESIGN.md`, `docs/architecture.md`, `docs/meta-ads/strategy.md` | 메인 세션 | 1–5 | - |
| 7 | GA 맞춤 측정기준 등록 `respondent_role` | GA 관리자 | 사용자 | 배포 후 | - |

### Task 1: 경로별 문구와 타입 (lib)

- `Role` 타입과 `parseRole(value): Role | null`.
- 질문 문구를 경로별로: `Question`에 `text: Record<Role, string>`(또는 `textFor(q, role)`), 경로별 안내 문구 `GUIDE`.
- `TOO_EARLY_COPY`를 경로별로. `LEVEL_COPY.weak.body`를 생활습관 문구로.
- 리포트 머리말·신호 카드 제목을 경로별로(`REPORT_COPY`).
- 테스트: 경로별 문구가 9개씩 있고 `id`·순서가 같다, `parseRole`, 판정이 경로와 무관하다.

### Task 2: 랜딩 다시 짜기

- `landing.tsx`를 ux-spec S1 위계로 다시 쓴다. 선택 카드는 shadcn `Card` + 링크가 아니라 버튼 하나로 감싼 카드(카드 안에 다른 조작 요소 없음), 고르면 200ms 선택 상태 뒤 `router.push`.
- 고를 때 `track({ name: "check_start", role })`. `track.ts`에서 `check_start`면 `respondent_role` 사용자 속성을 먼저 저장한다.
- `app/c/` 폴더와 `HEADLINES`·`HeadlineKey`를 지운다. `app/page.tsx`는 `<Landing />`.
- 검증: `make fe-check`, 로컬에서 두 카드로 각각 이동하는지.

### Task 3: 질문·리포트 경로 반영

- `app/check/page.tsx`: `searchParams.for`를 `parseRole`로 읽고, 없으면 `redirect("/")`. `CheckFlow`에 `role`을 넘긴다.
- `check-flow.tsx`: 경로별 문구·안내. 질문 1의 첫 답에서 `check_start`를 보내지 않는다. 질문 1에서 뒤로 가면 `/`(지금 history 되감기 로직과 맞춘다). 리포트로 `/r?for=<role>#<hash>`.
- `app/r/page.tsx`·`report-view.tsx`·`report.tsx`: `for`를 읽어(잘못되면 `partner`) 머리말, 신호 카드 제목, 판단 기준 문구, "아직 판단하기 일러요" 설명을 경로별로. `self`면 `ShareButton`을 그리지 않는다.
- 검증: `make fe-check`.

### Task 4: 리포트 경로별 퍼널

- 작업 08의 판정 단계별 조회와 같은 방식으로 `customUser:respondent_role` 측정기준 퍼널을 더한다. 단계: 체크 시작 → 체크 완료 → 병원 목록 진입 → 병원 연결. 줄 이름 "당사자" / "배우자" / "경로 없음".
- 조회 실패 시 "아직 없다". 테스트 추가.
- 검증: `make reporting-check`.

### Task 5: e2e·접근성

- `check-flow.spec.ts`: 두 경로 각각 랜딩 → 9개 답 → 리포트, 경로별 문구 확인, `self` 리포트에 "리포트 보내기"가 없음, `/check` 직접 접근 시 `/`로 이동, `/c/heal` 404.
- `a11y.spec.ts`: 랜딩 측정 대상을 새 구조로 고치고, 질문·리포트는 두 경로 모두 잰다.
- 검증: `make gate`.

### Task 6: 문서

- `DESIGN.md` 용어 표, `docs/architecture.md`(경로 쿼리·사용자 속성), `docs/meta-ads/strategy.md`(볼 숫자에 경로별 퍼널).

## 검증 기준

| 기준 | 방법 |
|---|---|
| 랜딩이 ux-spec S1 위계·문구와 같고 노랑 주요 버튼·고정 바가 없다 | 브라우저 확인, 스크린샷 |
| 두 경로 모두 끝까지 가고 문구가 ux-spec S2·S3 표와 같다 | e2e |
| 같은 답이면 두 경로의 판정 단계가 같다 | `sleep-check.test.ts` |
| `/check` 경로 없음·옛 링크는 `/`로, `/c/*`는 404 | e2e |
| 카드를 고를 때 `check_start`와 `respondent_role`이 가고 증상 답은 안 간다. 픽셀 호출은 그대로다 | `window.dataLayer` 확인, 코드 diff |
| 당사자 리포트에 "리포트 보내기"가 없다 | e2e |
| 글자 200%·폭 320px에서 카드가 잘리지 않고, 16px·48px·7:1 기준 통과 | `make fe-a11y`, 스크린샷 |
| 리포트에 경로별 퍼널이 나오고 조회 실패 시 멈추지 않는다 | `report.test.ts` |
| 게이트 통과 | `make gate` |
