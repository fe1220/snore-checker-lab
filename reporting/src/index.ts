// make meta-report: 메타 광고 + GA4 숫자를 모아 docs/meta-ads/results/<날짜>.md를 쓰고
// strategy.md의 결과 표를 갈아 끼운다. 반쪽 리포트를 남기지 않도록 두 조회가 다 끝난 뒤에만 쓴다.
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { fetchCampaignStart, fetchMetaRows } from "./meta.ts"
import { fetchGaRows, fetchUserFunnel } from "./ga4.ts"
import {
  mergeRows,
  renderReport,
  renderSummary,
  renderUserFunnel,
  replaceBetweenMarkers,
  usersByContent,
  usersByLevel,
} from "./report.ts"

const DOCS = fileURLToPath(new URL("../../docs/meta-ads/", import.meta.url))
const REQUIRED = [
  "META_ACCESS_TOKEN",
  "META_CAMPAIGN_ID",
  "GA4_PROPERTY_ID",
  "GA4_CREDENTIALS_FILE",
] as const

// KST 기준 날짜 문자열
function kstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}

async function main() {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`설정이 없어요: ${missing.join(", ")} (reporting/.env.local)`)
    process.exit(1)
  }
  const env = process.env as Record<(typeof REQUIRED)[number], string>
  const meta = {
    token: env.META_ACCESS_TOKEN,
    campaignId: env.META_CAMPAIGN_ID,
    version: process.env.META_API_VERSION ?? "v26.0",
  }

  const now = new Date()
  const until = argValue("--until") ?? kstDate(now)
  const since = argValue("--since") ?? kstDate(new Date(await fetchCampaignStart(meta)))
  if (since > until) {
    console.error(`집계 기간이 비었어요: ${since} ~ ${until}. --until로 날짜를 정해 주세요`)
    process.exit(1)
  }

  const ga = {
    propertyId: env.GA4_PROPERTY_ID,
    keyFile: env.GA4_CREDENTIALS_FILE,
    source: process.env.UTM_SOURCE ?? "meta",
    country: process.env.GA4_COUNTRY ?? "South Korea",
  }
  const [metaRows, gaRows, contentUsers, levelUsers] = await Promise.all([
    fetchMetaRows(meta, since, until),
    fetchGaRows(ga, since, until),
    fetchUserFunnel(ga, since, until, "sessionManualAdContent"),
    // 맞춤 측정기준(check_level)이 등록되기 전에는 조회가 실패한다. 리포트는 멈추지 않고 "아직 없다"로 쓴다.
    fetchUserFunnel(ga, since, until, "customUser:check_level").catch((err: unknown) => {
      console.warn(`판정 단계별 조회를 건너뛰어요: ${err instanceof Error ? err.message : err}`)
      return null
    }),
  ])
  if (metaRows.length === 0) {
    console.log(`메타에 ${since} ~ ${until} 집행 숫자가 아직 없어요. 리포트를 쓰지 않았어요`)
    return
  }
  const rows = mergeRows(metaRows, gaRows)

  const reportPath = `results/${until}.md`
  const generatedAt = `${kstDate(now)} ${now.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul" })} KST`
  await mkdir(`${DOCS}results`, { recursive: true })
  await writeFile(`${DOCS}${reportPath}`, renderReport({
      since,
      until,
      generatedAt,
      rows,
      userFunnel: renderUserFunnel(
        usersByContent(contentUsers),
        levelUsers && usersByLevel(levelUsers),
      ),
    }))

  const strategy = await readFile(`${DOCS}strategy.md`, "utf-8")
  await writeFile(`${DOCS}strategy.md`, replaceBetweenMarkers(strategy, renderSummary(rows, reportPath)))

  console.log(`docs/meta-ads/${reportPath} 작성, strategy.md 결과 표 갱신 (${since} ~ ${until}, 소재 ${rows.length}줄)`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
