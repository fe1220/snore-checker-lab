import { test } from "node:test"
import assert from "node:assert/strict"
import {
  END,
  NO_LEVEL,
  START,
  UNKNOWN,
  mergeRows,
  metrics,
  renderReport,
  renderRoleFunnel,
  renderSummary,
  renderUserFunnel,
  replaceBetweenMarkers,
  total,
  usersByContent,
  usersByLevel,
  usersByRole,
} from "./report.ts"
import { parseInsights } from "./meta.ts"
import { parseGaRows } from "./ga4.ts"

const meta = [
  { key: "B", spend: 20000, impressions: 4000, linkClicks: 80, landingViews: 60 },
  { key: "A", spend: 30000, impressions: 6000, linkClicks: 120, landingViews: 100 },
]
const ga = [
  { key: "A", checkStart: 70, checkComplete: 50, clinicClick: 6, clinicCall: 4, share: 3 },
  { key: UNKNOWN, checkStart: 2, checkComplete: 1, clinicClick: 0, clinicCall: 0, share: 0 },
]

test("소재 순서대로 합치고, 한쪽에만 있는 소재는 0으로 채운다", () => {
  const rows = mergeRows(meta, ga)
  assert.deepEqual(
    rows.map((r) => r.key),
    ["A", "B", UNKNOWN],
  )
  assert.equal(rows[1].checkComplete, 0)
  assert.equal(rows[2].spend, 0)
})

test("합계와 비율을 계산하고, 분모가 0이면 -로 쓴다", () => {
  const rows = mergeRows(meta, ga)
  const m = metrics(total(rows))
  assert.equal(m.spend, "50,000원")
  assert.equal(m.ctr, "2.0%")
  assert.equal(m.cpc, "250원")
  assert.equal(m.checkRate, "31.9%") // 51 / 160
  assert.equal(m.connect, "10") // 링크 6 + 전화 4
  assert.equal(m.costPerConnect, "5,000원")
  assert.equal(metrics(rows[1]).connectRate, "-")
})

test("리포트에 기간, 합계, 소재별 줄이 들어간다", () => {
  const md = renderReport({
    since: "2026-10-02",
    until: "2026-10-04",
    generatedAt: "2026-10-05 09:00:00 KST",
    rows: mergeRows(meta, ga),
  })
  assert.match(md, /2026-10-02 ~ 2026-10-04/)
  assert.match(md, /\| \*\*합계\*\* \| 50,000원 /)
  assert.match(md, new RegExp(`\\| ${UNKNOWN} \\|`))
})

test("결과 표는 표시 사이만 갈아 끼운다", () => {
  const doc = `앞\n${START}\n옛 표\n${END}\n뒤`
  const out = replaceBetweenMarkers(
    doc,
    renderSummary(mergeRows(meta, ga), "results/2026-10-04.md"),
  )
  assert.ok(out.startsWith(`앞\n${START}\n| 숫자 | 값 |`))
  assert.ok(out.endsWith(`${END}\n뒤`))
  assert.doesNotMatch(out, /옛 표/)
  assert.throws(() => replaceBetweenMarkers("표시 없음", "x"))
})

test("메타 응답에서 광고 이름, 숫자, 랜딩 조회를 읽는다", () => {
  const rows = parseInsights({
    data: [
      {
        ad_name: " A ",
        spend: "1234.5",
        impressions: "100",
        inline_link_clicks: "7",
        actions: [
          { action_type: "link_click", value: "7" },
          { action_type: "landing_page_view", value: "5" },
        ],
      },
      { ad_name: "B" },
    ],
  })
  assert.deepEqual(rows[0], {
    key: "A",
    spend: 1234.5,
    impressions: 100,
    linkClicks: 7,
    landingViews: 5,
  })
  assert.equal(rows[1].landingViews, 0)
})

test("GA4 행을 utm_content별로 묶고, 없는 값은 알 수 없음으로 둔다", () => {
  const rows = parseGaRows([
    { dimensionValues: [{ value: "A" }, { value: "check_complete" }], metricValues: [{ value: "5" }] },
    { dimensionValues: [{ value: "A" }, { value: "clinic_click" }], metricValues: [{ value: "2" }] },
    { dimensionValues: [{ value: "A" }, { value: "clinic_call" }], metricValues: [{ value: "1" }] },
    { dimensionValues: [{ value: "(not set)" }, { value: "check_start" }], metricValues: [{ value: "3" }] },
    { dimensionValues: [{ value: "A" }, { value: "page_view" }], metricValues: [{ value: "99" }] },
  ])
  assert.deepEqual(rows, [
    { key: "A", checkStart: 0, checkComplete: 5, clinicClick: 2, clinicCall: 1, share: 0 },
    { key: UNKNOWN, checkStart: 3, checkComplete: 0, clinicClick: 0, clinicCall: 0, share: 0 },
  ])
})

test("사람 수 퍼널을 소재별·판정 단계별로 묶고, 비율은 체크 완료 대비로 쓴다", () => {
  const content = usersByContent([
    { values: ["A"], step: "checkComplete", users: 20 },
    { values: ["A"], step: "clinicList", users: 8 },
    { values: ["A"], step: "connect", users: 3 },
    { values: ["(not set)"], step: "connect", users: 1 },
  ])
  assert.deepEqual(
    content.map((r) => r.key),
    ["A", UNKNOWN],
  )
  const level = usersByLevel([
    { values: ["weak", "self"], step: "checkComplete", users: 10 },
    { values: ["strong", "self"], step: "checkComplete", users: 5 },
    { values: ["strong", "self"], step: "connect", users: 2 },
    { values: ["strong", "shared"], step: "connect", users: 1 },
    { values: ["(not set)", "(not set)"], step: "clinicList", users: 4 },
  ])
  assert.deepEqual(
    level.map((r) => r.key),
    ["검사 권유 · 직접 체크", "검사 권유 · 공유받음", "신호 약함 · 직접 체크", NO_LEVEL],
  )
  const md = renderUserFunnel(content, level)
  assert.match(md, /\| \*\*합계\*\* \| 20 \| 8 \| 40\.0% \| 4 \| 20\.0% \|/)
  assert.match(md, /\| 검사 권유 · 직접 체크 \| 5 \| 0 \| 0\.0% \| 2 \| 40\.0% \|/)
  assert.match(md, /\| 검사 권유 · 공유받음 \| 0 \| 0 \| - \| 1 \| - \|/)
  assert.match(md, new RegExp(`\\| ${NO_LEVEL} \\| 0 \\| 4 \\| - \\|`))
})

test("판정 단계별 조회가 없으면 아직 없다고 쓴다", () => {
  const md = renderUserFunnel([], null)
  assert.match(md, /판정 단계별 숫자는 아직 없다/)
})

test("리포트에 사람 수 퍼널을 넣고 이벤트 수 기준임을 밝힌다", () => {
  const md = renderReport({
    since: "2026-10-02",
    until: "2026-10-04",
    generatedAt: "2026-10-05 09:00:00 KST",
    rows: mergeRows(meta, ga),
    userFunnel: renderUserFunnel([], null),
  })
  assert.match(md, /이벤트 수 기준이다/)
  assert.match(md, /## 사람 수 기준 퍼널/)
})

test("경로별 퍼널은 체크 시작부터 세고, 경로 속성이 없으면 경로 없음으로 둔다", () => {
  const rows = usersByRole([
    { values: ["partner"], step: "checkStart", users: 30 },
    { values: ["self"], step: "checkStart", users: 70 },
    { values: ["self"], step: "checkComplete", users: 35 },
    { values: ["self"], step: "connect", users: 7 },
    { values: ["(not set)"], step: "clinicList", users: 2 },
  ])
  assert.deepEqual(
    rows.map((r) => r.key),
    ["당사자", "배우자", "경로 없음"],
  )
  const md = renderRoleFunnel(rows)
  assert.match(md, /\| 당사자 \| 70 \| 35 \| 50\.0% \| 0 \| 7 \| 20\.0% \|/)
  assert.match(renderRoleFunnel(null), /경로별 숫자는 아직 없다/)
})
