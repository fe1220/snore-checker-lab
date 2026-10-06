# 검증: 랜딩 재설계·경로 나누기 (작업 09) + 판정 단계별 측정 (작업 08)

작업 08([spec](../08-measurement/spec.md), [plan](../08-measurement/plan.md))과 작업 09([spec](spec.md), [plan](plan.md))는 같은 파일(`components/analytics/track.ts`)을 바꿔 함께 검증한다. 화면 기준은 [ux-spec](../../ux-spec.md) S1·S2·S3·측정.

## 기준

| # | 기준 | 방법 | 결과 |
|---|---|---|---|
| 1 | 랜딩이 ux-spec S1 위계·문구와 같다: 헤드라인 "코골이,\n병원에 가볼 만할까요?", 보조 "질문 9개에 답하면 바로 알려드려요", 첫 질문, 카드 두 장(제목·설명), 신뢰 문구. 노랑 주요 버튼·하단 고정 바가 없다 | 브라우저(375px), 스크린샷 || PASS. 375px에서 h1·보조·h2·카드 2장·신뢰 2줄 순서와 문구 일치, fixed/sticky 요소 0, 카드 배경은 `bg-card`(노랑 채움 버튼 없음). `screenshots/s1-landing-375.png`, `landing.tsx:30-53` |
| 2 | 카드는 버튼 하나이고 안에 다른 조작 요소가 없다. 누르면 선택 상태 뒤 `/check?for=self` 또는 `?for=partner`로 간다. 연타해도 한 번만 이동한다 | 브라우저, e2e || PASS. 카드는 `<button>` 하나, 내부 조작 요소 0개(`path-choice.tsx:52-68`). dblclick 시 노랑 테두리(`s1-landing-selected-375.png`) 후 `/check?for=self` 한 번 이동, `check_start` 1회. e2e `카드를 고르면 check_start와 respondent_role이 한 번만 간다` |
| 3 | 두 경로 모두 질문 9개 → 리포트 → 병원 목록까지 간다. 안내·질문 문구가 ux-spec S2 표와 같다 | e2e, 코드와 ux-spec 대조 || PASS. e2e `self:`/`partner: 랜딩에서 카드를 고르고 9문항을 답하면…`이 9문항 문구를 `QUESTIONS[i].text[role]`로 확인. lib 문구(`sleep-check.ts:22-97`)가 ux-spec S2 표·안내와 글자 단위로 같음. 리포트 → `/clinics` 이동은 브라우저 스크립트로 두 경로 모두 확인 |
| 4 | 같은 답이면 두 경로의 판정 단계가 같다. 판정 기준·해시 형식(v2)은 바뀌지 않았다 | `sleep-check.test.ts`, diff || PASS. `judge()`·`STRONG_QUESTIONS`·`MODERATE_MIN`·인코딩 함수 diff 없음, 문항 id·순서 그대로. `judge`는 경로를 받지 않음. `sleep-check.test.ts` `v2 해시 형식이 고정돼 있다`, `v1 링크는 계속…` 통과. 두 경로 모두 전부 "네" → `#v2-e7-0`·3단계(e2e) |
| 5 | 리포트 경로별 차이가 ux-spec S3 표와 같다(머리말, 신호 카드 제목, 판단 기준 문구, 아직 판단하기 일러요). 당사자 리포트에 "리포트 보내기"가 없다. 신호 약함 설명이 생활습관 문구다 | e2e, 브라우저 || PASS. `REPORT_COPY`·`TOO_EARLY_COPY`(`sleep-check.ts:100-114, 203-212`)가 S3 표와 같음. self 리포트 "리포트 보내기" 0개(`report-view.tsx:86`, e2e, 브라우저). 신호 약함 설명이 생활습관 문구(`sleep-check.ts:192`, `s3-partner-weak-375.png`) |
| 6 | `/check`에 경로가 없거나 잘못되면(`?from=heal` 포함) `/`로 간다. `/c/*`는 404다. 질문 1에서 뒤로 가면 랜딩이다 | e2e || PASS. e2e `경로 없이 /check에 들어오면 랜딩으로 간다`(`/check`, `?from=heal`, `?for=husband`), `옛 카피별 랜딩 /c/heal은 없는 페이지다`(404), `첫 질문에서 뒤로 가면…`, `'처음 화면으로 가기'를…` 통과. `app/c/` 삭제됨 |
| 7 | 옛 리포트 링크(`/r#v1-...`, `/r#v2-...`)와 공유 링크(`/r?shared=1#...`)가 배우자 기준으로 그대로 열린다 | e2e || PASS. 브라우저: `/r#v1-e7`·`/r#v2-e7-0`·`/r?for=bogus#v2-0-0` 모두 배우자 머리말 + 리포트 보내기 1개, `/r?shared=1#v2-e7-0`은 공유받은 머리말 + 보내기 0개. e2e `경로 쿼리가 없는 옛 리포트와 공유받은 리포트는 배우자 기준으로 연다`, a11y `s3-legacy-v1`·`s3-shared` |
| 8 | GA: 카드를 고를 때 `respondent_role` 사용자 속성 → `check_start`(`role`) 순서로 한 번 간다. 체크 완료 때 `check_level`·`report_source: self` → `check_complete`. 공유받은 리포트를 열 때 `check_level`·`report_source: shared`. 증상 답과 해시는 어디에도 가지 않는다 | `track.test.ts`, e2e, 브라우저 `window.dataLayer`(GA ID가 없으면 gtag 스텁으로 확인), 코드 리뷰 || PASS. gtag 스텁 순서: `set user_properties {respondent_role}` → `event check_start {role}`(1회) / `set {check_level, report_source: self}` → `event check_complete {level}` → `fbq Lead` / 공유 리포트에서 `set {check_level: strong, report_source: shared}`. page_view `page_location`에 해시 없음. `track.test.ts` 5개 통과 |
| 9 | 메타 픽셀 호출(`Lead`, `ClinicClick`, `PageView`)이 바뀌지 않았다 | diff || PASS. `PIXEL_EVENTS`와 `analytics.tsx` diff 없음. 브라우저에서 `PageView`·`Lead`만 호출, 해시 있는 `/r`에선 픽셀 호출 없음. `track.test.ts` `체크 시작은 메타 픽셀로 보내지 않는다` |
| 10 | 글자 16px 이상, 터치 48px 이상, 대비 7:1. 랜딩 카드 높이 88px 이상, 글자 200%·폭 320px에서 잘림·겹침·가로 스크롤 없음 | `make fe-a11y`, 스크린샷 || PASS. gate a11y: `s1-start`·`s2-self/partner`·`s3-*` 16px·48px·7:1·axe·320px 가로 스크롤·130/200% 넘침 전부 통과. `s1 경로 카드 › 폭 320/375px, 글자 100/200%에서 카드 두 장이 88px 이상이고 겹치지 않는다` 4개 통과. 카드 높이 90px(100%), `screenshots/s1-landing-320-200.png` |
| 11 | 원시 색상값·임의 간격이 없다(`DESIGN.md`). 화면당 노랑 주요 버튼 하나 이하 | 코드 리뷰 || PASS. 바뀐 컴포넌트에 hex·팔레트 색·`[..px]` 임의값 없음(`min-h-22`=88px는 기본 스케일). 랜딩 노랑 채움 버튼 0, 리포트는 "근처 수면클리닉 찾기" 하나(`report-view.tsx:79-86`) |
| 12 | `make meta-report`: 사람 수 기준 퍼널(소재별), 판정 단계별 표(직접 체크·공유받음 분리), 경로별 퍼널이 나온다. 맞춤 측정기준이 없으면 리포트가 멈추지 않고 "아직 없다"로 쓴다. 기존 이벤트 수 표는 "이벤트 수 기준"으로 표시된다 | `report.test.ts`, 코드 리뷰 || PASS. `report.test.ts` `사람 수 퍼널을 소재별·판정 단계별로…`, `판정 단계별 조회가 없으면 아직 없다고 쓴다`, `리포트에 사람 수 퍼널을 넣고 이벤트 수 기준임을 밝힌다`, `경로별 퍼널은 체크 시작부터 세고…` 통과. `index.ts`에서 맞춤 측정기준 조회는 `.catch(skip(...))`로 null → "아직 없다" |
| 13 | 레이어 규칙(`app → components → lib → data`)을 지키고, 경로별 문구는 `lib/sleep-check.ts`에만 정의된다 | lint, 코드 리뷰 || PASS. eslint(`no-restricted-imports`) 통과, `lib/`는 components를 import하지 않음. 질문·안내·리포트 경로별 문구는 `sleep-check.ts`에만 있음. 랜딩 카드 문구만 `path-choice.tsx:10-21`에 있음(한 곳에서만 씀) |
| 14 | 문서: `DESIGN.md` 용어 표, `architecture.md` 분석 이벤트·사용자 속성, `meta-ads/strategy.md` 볼 숫자가 구현과 맞다 | 문서 대조 || PASS. `DESIGN.md` 용어 표(코 고는 사람·첫 질문 선택지), `architecture.md` `check_start`(role)·사용자 속성 3개 표·`for` 쿼리, `strategy.md` 2차 볼 숫자 2줄이 구현과 같음. 서식 경미: `architecture.md:123` 굵은 제목 앞에 빈 줄이 없어 위 목록 항목에 붙음 |
| 15 | `make gate` 통과 | 실행 || PASS. `make gate` 종료 0, `GATE PASS`. vitest 39 passed, crawler·reporting 테스트 통과, Playwright 200 passed / 120 skipped(스크린샷 테스트, `A11Y_SHOTS` 없을 때 건너뜀) |

## 범위 밖

- 실제 GA 수집(로컬에 GA ID 없음)과 GA 관리자 맞춤 측정기준 등록: 배포 후 사용자가 확인한다.
- lab 별도 배포.

## 판정

검증: 독립 서브에이전트, 2026-10-06. 대상 커밋 `4e0e1dd`..`ae53683`.

**결론: 15개 기준 모두 PASS.** `make gate` 통과(종료 코드 0).

근거 자료
- `make gate` 로그: vitest 39/39, crawler·reporting 테스트 통과, Playwright 200 passed / 120 skipped(스크린샷 전용 테스트는 `A11Y_SHOTS=1`일 때만 돈다).
- 브라우저(개발 서버 `localhost:3000`, 375px, `window.gtag`·`window.fbq` 스텁) 스크린샷: `screenshots/s1-landing-375.png`, `s1-landing-selected-375.png`, `s1-landing-320-200.png`, `s1-landing-375-200.png`, `s2-self-q1-375.png`, `s3-self-strong-375.png`, `s3-partner-weak-375.png`.
- 당사자 경로 호출 순서(스텁): `page_view /` → `set respondent_role=self` → `check_start {role: self}` → `page_view /check?for=self` → … → `set check_level=strong, report_source=self` → `check_complete {level: strong}` → `fbq Lead` → `page_view /r?for=self`(해시 없음) → `page_view /clinics`.

막지 않는 관찰
- 글자 200%에서 두 번째 카드가 첫 화면(812px) 아래로 내려간다(`s1-landing-320-200.png`). ux-spec 접근성 표 S1의 "카드 두 장이 첫 화면에 들어오는지 확인" 항목은 기준 10에 들어 있지 않아 FAIL로 보지 않았다. 잘림·겹침·가로 스크롤은 없다.
- `architecture.md:123`: `**GA 사용자 속성**` 앞에 빈 줄이 없어 위 목록 항목에 붙어 보인다. 빈 줄 하나를 넣으면 된다.
- `app/r/page.tsx:6` 메타 설명이 "옆에서 본 코골이…"로 고정이다. 당사자 리포트 탭에도 같은 설명이 붙지만, 공유 링크는 배우자 경로에서만 만들어 미리보기에는 영향이 없다.
- 개발 서버에서 랜딩 `page_view`가 두 번 찍힌다(React StrictMode의 effect 두 번 실행). 프로덕션 빌드에는 해당하지 않는다.
- 범위 밖: 실제 GA 수집과 GA 관리자의 `respondent_role`·`check_level`·`report_source` 맞춤 측정기준 등록은 배포 후 사용자가 확인한다.
