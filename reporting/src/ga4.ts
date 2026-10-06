// GA4 Data API에서 광고로 들어온 세션의 퍼널 이벤트 수를 utm_content별로 읽는다.
import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { UNKNOWN, type GaRow, type UserCount, type UserStep } from "./report.ts"

const EVENTS = {
  check_start: "checkStart",
  check_complete: "checkComplete",
  clinic_click: "clinicClick",
  clinic_call: "clinicCall",
  share_click: "share",
} as const

type EventName = keyof typeof EVENTS

export type GaApiRow = {
  dimensionValues?: { value?: string | null }[] | null
  metricValues?: { value?: string | null }[] | null
}

export function parseGaRows(rows: GaApiRow[]): GaRow[] {
  const byKey = new Map<string, GaRow>()
  for (const row of rows) {
    const [content, event] = (row.dimensionValues ?? []).map(
      (d) => d.value ?? "",
    )
    const field = EVENTS[event as EventName]
    if (!field) continue
    const key = !content || content === "(not set)" ? UNKNOWN : content.trim()
    const r =
      byKey.get(key) ??
      byKey
        .set(key, {
          key,
          checkStart: 0,
          checkComplete: 0,
          clinicClick: 0,
          clinicCall: 0,
          share: 0,
        })
        .get(key)!
    r[field] += Number(row.metricValues?.[0]?.value ?? 0)
  }
  return [...byKey.values()]
}

export type GaConfig = {
  propertyId: string
  keyFile: string
  source: string // utm_source 값
  country: string // GA4 국가 이름. 광고 심사 봇(미국·스웨덴·아일랜드 메타 데이터센터)을 거른다
}

const baseFilters = (c: GaConfig) => [
  {
    filter: {
      fieldName: "sessionSource",
      stringFilter: { value: c.source, matchType: "EXACT" as const },
    },
  },
  {
    filter: {
      fieldName: "country",
      stringFilter: { value: c.country, matchType: "EXACT" as const },
    },
  },
]

const exact = (fieldName: string, value: string) => ({
  filter: { fieldName, stringFilter: { value, matchType: "EXACT" as const } },
})

export async function fetchGaRows(
  c: GaConfig,
  since: string,
  until: string,
): Promise<GaRow[]> {
  const client = new BetaAnalyticsDataClient({ keyFilename: c.keyFile })
  const [res] = await client.runReport({
    property: `properties/${c.propertyId}`,
    dateRanges: [{ startDate: since, endDate: until }],
    dimensions: [{ name: "sessionManualAdContent" }, { name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          ...baseFilters(c),
          {
            filter: {
              fieldName: "eventName",
              inListFilter: { values: Object.keys(EVENTS) },
            },
          },
        ],
      },
    },
    limit: 1000,
  })
  return parseGaRows(res.rows ?? [])
}

// 사람 수 기준 퍼널. 단계마다 조건이 달라 따로 조회한다.
// 병원 연결은 측정기준에 이벤트 이름을 넣지 않아, 링크와 전화를 둘 다 누른 사람도 한 번만 센다.
const STEPS: { field: UserStep; filter: object }[] = [
  { field: "checkStart", filter: exact("eventName", "check_start") },
  { field: "checkComplete", filter: exact("eventName", "check_complete") },
  {
    field: "clinicList",
    filter: {
      andGroup: {
        expressions: [exact("eventName", "page_view"), exact("pagePath", "/clinics")],
      },
    },
  },
  {
    field: "connect",
    filter: {
      filter: {
        fieldName: "eventName",
        inListFilter: { values: ["clinic_click", "clinic_call"] },
      },
    },
  },
]

// 소재별(sessionManualAdContent) 또는 판정 단계·리포트 출처별(customUser:check_level, customUser:report_source)로 사용자 수를 센다.
export async function fetchUserFunnel(
  c: GaConfig,
  since: string,
  until: string,
  dimensions: string[],
  steps: UserStep[] = ["checkComplete", "clinicList", "connect"],
): Promise<UserCount[]> {
  const client = new BetaAnalyticsDataClient({ keyFilename: c.keyFile })
  const results = await Promise.all(
    STEPS.filter((s) => steps.includes(s.field)).map(async ({ field, filter }) => {
      const [res] = await client.runReport({
        property: `properties/${c.propertyId}`,
        dateRanges: [{ startDate: since, endDate: until }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: {
          andGroup: { expressions: [...baseFilters(c), filter] },
        },
        limit: 1000,
      })
      return parseUserRows(res.rows ?? [], field)
    }),
  )
  return results.flat()
}

export function parseUserRows(rows: GaApiRow[], step: UserStep): UserCount[] {
  return rows.map((row) => ({
    values: (row.dimensionValues ?? []).map((d) => d.value ?? ""),
    step,
    users: Number(row.metricValues?.[0]?.value ?? 0),
  }))
}
