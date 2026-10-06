// 메타 광고 숫자와 GA4 퍼널을 소재별로 합치고 마크다운으로 만든다. 순수 함수만 둔다.

export type MetaRow = {
  key: string // 광고 이름 = utm_content (A, B, C, D1, D2)
  spend: number // 원
  impressions: number
  linkClicks: number
  landingViews: number
}

export type GaRow = {
  key: string // utm_content. 없으면 UNKNOWN
  checkStart: number
  checkComplete: number
  clinicClick: number // 병원 외부 링크
  clinicCall: number // 병원 전화
  share: number
}

export type Row = MetaRow & Omit<GaRow, "key">

// 사람 수 기준 퍼널. 이벤트 수와 달리 한 사람이 병원 여러 곳을 눌러도 한 번만 센다.
export type UserStep = "checkStart" | "checkComplete" | "clinicList" | "connect"
export type UserCount = { values: string[]; step: UserStep; users: number } // 측정기준 값: [utm_content] 또는 [check_level, report_source]
export type UserRow = { key: string } & Record<UserStep, number>

export const UNKNOWN = "알 수 없음"
export const NO_LEVEL = "단계 없음"
// 리포트 화면과 같은 단계 이름을 쓴다.
const LEVEL_NAMES: Record<string, string> = {
  strong: "검사 권유",
  moderate: "상담 권유",
  weak: "신호 약함",
}
const ORDER = ["A", "B", "C", "D1", "D2"]

const EMPTY_META = { spend: 0, impressions: 0, linkClicks: 0, landingViews: 0 }
const EMPTY_GA = {
  checkStart: 0,
  checkComplete: 0,
  clinicClick: 0,
  clinicCall: 0,
  share: 0,
}

function order(key: string): number {
  if (key === UNKNOWN) return ORDER.length + 1
  const i = ORDER.indexOf(key)
  return i === -1 ? ORDER.length : i
}

export function mergeRows(meta: MetaRow[], ga: GaRow[]): Row[] {
  const rows = new Map<string, Row>()
  const get = (key: string) =>
    rows.get(key) ??
    rows.set(key, { key, ...EMPTY_META, ...EMPTY_GA }).get(key)!
  for (const m of meta) {
    const r = get(m.key)
    r.spend += m.spend
    r.impressions += m.impressions
    r.linkClicks += m.linkClicks
    r.landingViews += m.landingViews
  }
  for (const g of ga) {
    const r = get(g.key)
    r.checkStart += g.checkStart
    r.checkComplete += g.checkComplete
    r.clinicClick += g.clinicClick
    r.clinicCall += g.clinicCall
    r.share += g.share
  }
  return [...rows.values()].sort(
    (a, b) => order(a.key) - order(b.key) || a.key.localeCompare(b.key),
  )
}

export function total(rows: Row[]): Row {
  return rows.reduce<Row>(
    (t, r) => ({
      key: "합계",
      spend: t.spend + r.spend,
      impressions: t.impressions + r.impressions,
      linkClicks: t.linkClicks + r.linkClicks,
      landingViews: t.landingViews + r.landingViews,
      checkStart: t.checkStart + r.checkStart,
      checkComplete: t.checkComplete + r.checkComplete,
      clinicClick: t.clinicClick + r.clinicClick,
      clinicCall: t.clinicCall + r.clinicCall,
      share: t.share + r.share,
    }),
    { key: "합계", ...EMPTY_META, ...EMPTY_GA },
  )
}

const int = (n: number) => Math.round(n).toLocaleString("ko-KR")
const won = (n: number) => `${int(n)}원`
const pct = (a: number, b: number) =>
  b === 0 ? "-" : `${((a / b) * 100).toFixed(1)}%`
const per = (a: number, b: number) => (b === 0 ? "-" : won(a / b))

// 병원 연결 = 외부 링크 클릭 + 전화. 같은 목적(병원으로 넘어감)의 두 수단이라 합쳐서 본다.
export function metrics(r: Row) {
  const connect = r.clinicClick + r.clinicCall
  return {
    spend: won(r.spend),
    impressions: int(r.impressions),
    linkClicks: int(r.linkClicks),
    ctr: pct(r.linkClicks, r.impressions),
    cpc: per(r.spend, r.linkClicks),
    landingViews: int(r.landingViews),
    checkComplete: int(r.checkComplete),
    checkRate: pct(r.checkComplete, r.landingViews),
    connect: int(connect),
    connectRate: pct(connect, r.checkComplete),
    costPerConnect: per(r.spend, connect),
    clinicClick: int(r.clinicClick),
    clinicCall: int(r.clinicCall),
  }
}

const HEADER =
  "| 소재 | 비용 | 노출 | 링크 클릭 | 클릭률 | 클릭당 비용 | 랜딩 조회 | 체크 완료 | 체크 완료율 | 병원 연결 | 병원 연결률 | 병원 연결 1건당 비용 | 링크 · 전화 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|"

function line(r: Row): string {
  const m = metrics(r)
  const name = r.key === "합계" ? "**합계**" : r.key
  return `| ${name} | ${m.spend} | ${m.impressions} | ${m.linkClicks} | ${m.ctr} | ${m.cpc} | ${m.landingViews} | ${m.checkComplete} | ${m.checkRate} | ${m.connect} | ${m.connectRate} | ${m.costPerConnect} | ${m.clinicClick} · ${m.clinicCall} |`
}

export function renderReport(input: {
  since: string
  until: string
  generatedAt: string
  rows: Row[]
  userFunnel?: string
}): string {
  const t = total(input.rows)
  return `# 메타 광고 결과: ${input.until}까지

- 집계 기간: ${input.since} ~ ${input.until} (누적)
- 생성: ${input.generatedAt}, \`make meta-report\`
- 전략과 볼 숫자: [strategy.md](../strategy.md)

## 합계

${HEADER}
${line(t)}

- 공유 클릭 ${int(t.share)}건, 체크 시작 ${int(t.checkStart)}건
- 이 표와 아래 소재별 표는 이벤트 수 기준이다. 한 사람이 병원 여러 곳을 누르면 병원 연결이 여러 번 잡힌다.

${input.userFunnel ?? ""}
## 소재별

메타가 예산을 반응 좋은 소재에 몰아주므로 소재별 숫자는 참고만 한다.

${HEADER}
${input.rows.map(line).join("\n")}

## 주의

- 병원 연결은 병원 외부 링크 클릭과 전화 걸기를 합친 수다. 실제 방문 여부는 추적하지 않는다.
- 비용·노출·클릭·랜딩 조회는 메타, 체크·병원 연결은 GA4 숫자다. 둘은 광고 이름과 \`utm_content\`로 잇는다.
- GA4는 광고 차단·추적 거부로 일부 이벤트가 빠져 실제보다 적을 수 있다.
- 메타 숫자는 며칠 동안 보정될 수 있다. "${UNKNOWN}" 줄은 \`utm_content\`가 없거나 광고 이름과 맞지 않는 GA4 숫자다.
`
}

export function renderSummary(rows: Row[], reportPath: string): string {
  const m = metrics(total(rows))
  return `| 숫자 | 값 |
|---|---|
| 노출 · 링크 클릭 · 클릭률 | ${m.impressions} · ${m.linkClicks} · ${m.ctr} |
| 클릭당 비용 | ${m.cpc} |
| 체크 완료율 | ${m.checkRate} |
| 병원 연결률 (링크 · 전화) | ${m.connectRate} (${m.clinicClick} · ${m.clinicCall}) |
| 병원 연결 1건당 비용 | ${m.costPerConnect} |

최신 리포트: [${reportPath}](${reportPath})`
}

const blank = (value: string): boolean => !value || value === "(not set)"

function groupUsers(counts: UserCount[], keyOf: (values: string[]) => string): UserRow[] {
  const rows = new Map<string, UserRow>()
  for (const c of counts) {
    const key = keyOf(c.values)
    const r =
      rows.get(key) ??
      rows
        .set(key, { key, checkStart: 0, checkComplete: 0, clinicList: 0, connect: 0 })
        .get(key)!
    r[c.step] += c.users
  }
  return [...rows.values()]
}

export function usersByContent(counts: UserCount[]): UserRow[] {
  return groupUsers(counts, ([v = ""]) => (blank(v) ? UNKNOWN : v.trim())).sort(
    (a, b) => order(a.key) - order(b.key) || a.key.localeCompare(b.key),
  )
}

const SOURCE_NAMES: Record<string, string> = { self: "직접 체크", shared: "공유받음" }

function levelKey([level = "", source = ""]: string[]): string {
  const name = LEVEL_NAMES[level]
  if (!name) return NO_LEVEL
  return SOURCE_NAMES[source] ? `${name} · ${SOURCE_NAMES[source]}` : name
}

export function usersByLevel(counts: UserCount[]): UserRow[] {
  const names = [
    ...Object.values(LEVEL_NAMES).flatMap((n) => [
      `${n} · ${SOURCE_NAMES.self}`,
      `${n} · ${SOURCE_NAMES.shared}`,
      n,
    ]),
    NO_LEVEL,
  ]
  return groupUsers(counts, levelKey).sort(
    (a, b) => names.indexOf(a.key) - names.indexOf(b.key),
  )
}

function userTotal(rows: UserRow[]): UserRow {
  return rows.reduce<UserRow>(
    (t, r) => ({
      key: "합계",
      checkStart: t.checkStart + r.checkStart,
      checkComplete: t.checkComplete + r.checkComplete,
      clinicList: t.clinicList + r.clinicList,
      connect: t.connect + r.connect,
    }),
    { key: "합계", checkStart: 0, checkComplete: 0, clinicList: 0, connect: 0 },
  )
}

function userLine(r: UserRow): string {
  const name = r.key === "합계" ? "**합계**" : r.key
  return `| ${name} | ${int(r.checkComplete)} | ${int(r.clinicList)} | ${pct(r.clinicList, r.checkComplete)} | ${int(r.connect)} | ${pct(r.connect, r.checkComplete)} |`
}

function userTable(label: string, rows: UserRow[], withTotal: boolean): string {
  const body = withTotal ? [userTotal(rows), ...rows] : rows
  return `| ${label} | 체크 완료 | 병원 목록 진입 | 병원 목록 진입률 | 병원 연결 | 병원 연결률 |
|---|---|---|---|---|---|
${body.map(userLine).join("\n")}`
}

export const NO_ROLE = "경로 없음"
const ROLE_NAMES: Record<string, string> = { self: "당사자", partner: "배우자" }

export function usersByRole(counts: UserCount[]): UserRow[] {
  const names = [...Object.values(ROLE_NAMES), NO_ROLE]
  return groupUsers(counts, ([v = ""]) => ROLE_NAMES[v] ?? NO_ROLE).sort(
    (a, b) => names.indexOf(a.key) - names.indexOf(b.key),
  )
}

function roleLine(r: UserRow): string {
  return `| ${r.key} | ${int(r.checkStart)} | ${int(r.checkComplete)} | ${pct(r.checkComplete, r.checkStart)} | ${int(r.clinicList)} | ${int(r.connect)} | ${pct(r.connect, r.checkComplete)} |`
}

// 경로별 퍼널(H1). 체크 시작은 랜딩에서 경로를 고른 순간이라, 체크 시작 비중이 곧 경로 비중이다.
export function renderRoleFunnel(byRole: UserRow[] | null): string {
  const body =
    byRole && byRole.length > 0
      ? `| 경로 | 체크 시작 | 체크 완료 | 체크 완료율 | 병원 목록 진입 | 병원 연결 | 병원 연결률 |
|---|---|---|---|---|---|---|
${byRole.map(roleLine).join("\n")}`
      : "경로별 숫자는 아직 없다. GA에 사용자 범위 맞춤 측정기준 `respondent_role`을 등록해야 나온다."
  return `## 경로별 (당사자 · 배우자)

${body}

- 체크 완료율은 체크 시작 대비, 병원 연결률은 체크 완료 대비다. H1 판정은 결과 조회(체크 완료) 100건 이상에서 한쪽 경로가 70% 이상인지로 본다([validation](../../validation.md#h1-당사자에게-말을-거는-게-병원까지-더-잘-이어진다)).
- "${NO_ROLE}"은 경로 속성이 없는 사람이다. 경로 저장 전에 체크했거나 공유받은 리포트로 들어온 사람이다.
`
}

// 사람 수 기준 퍼널과 판정 단계별 표. 단계별 조회가 실패하면(맞춤 측정기준 미등록 등) byLevel이 null이다.
export function renderUserFunnel(byContent: UserRow[], byLevel: UserRow[] | null): string {
  const levels =
    byLevel && byLevel.length > 0
      ? userTable("판정 단계", byLevel, false)
      : "판정 단계별 숫자는 아직 없다. GA에 사용자 범위 맞춤 측정기준 `check_level`, `report_source`를 등록해야 나온다."
  return `## 사람 수 기준 퍼널

체크 완료 → 병원 목록 진입(\`/clinics\` 조회) → 병원 연결(병원 정보 보기·전화하기)을 사용자 수로 센다. 비율은 모두 체크 완료 대비다.

${userTable("소재", byContent, true)}

## 판정 단계별

${levels}

- "공유받음"은 공유 링크로 리포트를 연 사람이다. 직접 체크하지 않아 체크 완료가 0이고 비율은 -로 나온다. 사람 수로 본다.
- "${NO_LEVEL}"은 판정 단계 속성이 없는 사람이다. 속성 저장 전에 체크한 사람, 다른 기기로 다시 들어온 사람이 여기 들어간다.
- 소재를 옮겨 다닌 사람은 소재별 표에서 두 번 잡힐 수 있다.
`
}

export const START = "<!-- meta-report:start -->"
export const END = "<!-- meta-report:end -->"

export function replaceBetweenMarkers(doc: string, content: string): string {
  const s = doc.indexOf(START)
  const e = doc.indexOf(END)
  if (s === -1 || e === -1 || e < s)
    throw new Error(`결과 표 표시(${START}, ${END})를 찾을 수 없어요`)
  return `${doc.slice(0, s + START.length)}\n${content}\n${doc.slice(e)}`
}
