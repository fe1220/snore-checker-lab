import { expect, test, type Page } from "@playwright/test"
import {
  GUIDE,
  QUESTIONS,
  REPORT_COPY,
  TOO_EARLY_COPY,
  type Role,
} from "@/lib/sleep-check"

const TOTAL = QUESTIONS.length

// 랜딩 카드 이름. components/sleep/path-choice.tsx의 CHOICES 제목과 같다.
const CARD: Record<Role, string> = {
  self: "내 코골이",
  partner: "함께 자는 사람의 코골이",
}

// 분석 키 없이 빌드해도 track()이 부르는 window.gtag를 가로채 이벤트를 센다.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const events: unknown[][] = []
    Object.assign(window, {
      __events: events,
      gtag: (...args: unknown[]) => events.push(args),
    })
  })
})

function calls(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __events: unknown[][] }).__events,
  )
}

async function events(page: Page, name: string) {
  return (await calls(page)).filter((e) => e[0] === "event" && e[1] === name)
}

function step(page: Page, n: number) {
  return expect(page.getByText(`${n} / ${TOTAL} ·`)).toBeVisible()
}

async function answer(page: Page, label: string, next: number) {
  await page.getByRole("button", { name: label, exact: true }).click()
  await step(page, next)
}

// 랜딩에서 카드를 골라 첫 질문까지 간다.
async function start(page: Page, role: Role = "partner") {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: new RegExp(`^${CARD[role]}`) }).click()
  await expect(page).toHaveURL(new RegExp(`/check\\?for=${role}$`))
  await step(page, 1)
}

function expectLanding(page: Page) {
  return expect(
    page.getByRole("heading", { name: "누구의 코골이가 궁금하세요?" }),
  ).toBeVisible()
}

for (const role of ["self", "partner"] as const) {
  test(`${role}: 랜딩에서 카드를 고르고 9문항을 답하면 경로별 문구로 리포트가 보인다`, async ({
    page,
  }) => {
    await start(page, role)
    await expect(page.getByText(`1 / ${TOTAL} · ${GUIDE[role]}`)).toBeVisible()
    for (let i = 0; i < TOTAL; i++) {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        QUESTIONS[i].text[role],
      )
      if (i + 1 < TOTAL) await answer(page, "네", i + 2)
    }
    await page.getByRole("button", { name: "네", exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/r\\?for=${role}#v2-e7-0$`))
    await expect(page.getByLabel(/^3단계 중 3단계/)).toBeVisible()
    await expect(page.getByText(REPORT_COPY[role].header)).toBeVisible()
    await expect(page.getByText(REPORT_COPY[role].signalsTitle)).toBeVisible()
    await expect(
      page.getByText(QUESTIONS[0].text[role], { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "리포트 보내기" }),
    ).toHaveCount(role === "partner" ? 1 : 0)
  })
}

test("카드를 고르면 check_start와 respondent_role이 한 번만 간다", async ({
  page,
}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: /^내 코골이/ }).dblclick()
  await expect(page).toHaveURL(/\/check\?for=self$/)
  await step(page, 1)
  const starts = await events(page, "check_start")
  expect(starts).toEqual([["event", "check_start", { role: "self" }]])
  const roles = (await calls(page)).filter(
    (e) => e[0] === "set" && e[1] === "user_properties",
  )
  expect(roles).toEqual([
    ["set", "user_properties", { respondent_role: "self" }],
  ])
  // 첫 답에서는 더 보내지 않는다.
  await answer(page, "네", 2)
  expect(await events(page, "check_start")).toHaveLength(1)
})

test("경로 없이 /check에 들어오면 랜딩으로 간다", async ({ page }) => {
  for (const path of ["/check", "/check?from=heal", "/check?for=husband"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/:\d+\/$/)
    await expectLanding(page)
  }
})

test("옛 카피별 랜딩 /c/heal은 없는 페이지다", async ({ page }) => {
  const response = await page.goto("/c/heal")
  expect(response?.status()).toBe(404)
})

test("첫 질문에서 뒤로 가면 랜딩으로 돌아간다", async ({ page }) => {
  await start(page, "self")
  await page.goBack()
  await expect(page).toHaveURL(/:\d+\/$/)
  await expectLanding(page)
})

test("첫 질문에서 '처음 화면으로 가기'를 누르면 랜딩으로 돌아간다", async ({
  page,
}) => {
  await start(page, "partner")
  await page.getByRole("button", { name: "처음 화면으로 가기" }).click()
  await expect(page).toHaveURL(/:\d+\/$/)
  await expectLanding(page)
})

test("3번째 질문에서 뒤로 가기를 누르면 2번째 질문으로 돌아간다", async ({
  page,
}) => {
  await start(page)
  await answer(page, "아니요", 2)
  const second = await page.getByRole("heading", { level: 1 }).innerText()
  await answer(page, "아니요", 3)
  await page.goBack()
  await step(page, 2)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(second)
  await expect(page).toHaveURL(/\/check\?for=partner$/)
})

test("3번째 질문에서 '이전 질문'을 누르면 2번째 질문으로 돌아간다", async ({
  page,
}) => {
  await start(page)
  await answer(page, "아니요", 2)
  const second = await page.getByRole("heading", { level: 1 }).innerText()
  await answer(page, "아니요", 3)
  await page.getByRole("button", { name: "이전 질문으로 가기" }).click()
  await step(page, 2)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(second)
})

test("답을 누른 직후 '이전 질문'을 누르면 앞으로 넘어가지 않는다", async ({
  page,
}) => {
  await start(page)
  await answer(page, "아니요", 2)
  await page.getByRole("button", { name: "아니요", exact: true }).click()
  await page.getByRole("button", { name: "이전 질문으로 가기" }).click()
  await step(page, 1)
  // 답을 보여주는 0.2초가 지나도 그대로여야 한다.
  await page.waitForTimeout(500)
  await step(page, 1)
})

test("마지막 문항을 빠르게 두 번 눌러도 리포트로 한 번만 간다", async ({
  page,
}) => {
  await start(page)
  for (let i = 1; i < TOTAL; i++) await answer(page, "아니요", i + 1)
  const reports: string[] = []
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/r")
      reports.push(frame.url())
  })
  await page.getByRole("button", { name: "아니요", exact: true }).dblclick()
  await expect(page).toHaveURL(/\/r\?for=partner#v2-0-0$/)
  await page.waitForTimeout(500)
  expect(reports).toHaveLength(1)
  expect(await events(page, "check_complete")).toHaveLength(1)
  expect(await events(page, "check_start")).toHaveLength(1)
})

test("질문이 바뀌면 초점이 질문 제목으로 간다", async ({ page }) => {
  await start(page)
  for (const [label, next] of [
    ["아니요", 2],
    ["네", 3],
  ] as const) {
    await answer(page, label, next)
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused()
  }
  await page.goBack()
  await step(page, 2)
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused()
})

for (const role of ["self", "partner"] as const) {
  test(`${role}: 주요 신호를 모른다고 답하면 경로별 '아직 판단하기 일러요' 설명이 보인다`, async ({
    page,
  }) => {
    await start(page, role)
    for (let i = 1; i < TOTAL; i++) await answer(page, "잘 모르겠어요", i + 1)
    await page
      .getByRole("button", { name: "잘 모르겠어요", exact: true })
      .click()
    await expect(page).toHaveURL(new RegExp(`/r\\?for=${role}#v2-0-[0-9a-z]+$`))
    await expect(
      page.getByRole("heading", { name: TOO_EARLY_COPY[role].title }),
    ).toBeVisible()
    await expect(page.getByText(TOO_EARLY_COPY[role].body)).toBeVisible()
    await expect(page.getByText("지금은 걱정 신호가 적어요")).toHaveCount(0)
  })
}

test("신호 약함 리포트에는 위험·치료 이득 카드가 없다", async ({ page }) => {
  await page.goto("/r#v2-0-0")
  await expect(
    page.getByRole("heading", { name: "지금은 걱정 신호가 적어요" }),
  ).toBeVisible()
  await expect(page.getByText("치료하지 않으면")).toHaveCount(0)
  await expect(page.getByText("치료하면", { exact: true })).toHaveCount(0)
  await expect(page.getByText("검사는 이렇게 받아요")).toBeVisible()
})

test("경로 쿼리가 없는 옛 리포트와 공유받은 리포트는 배우자 기준으로 연다", async ({
  page,
}) => {
  await page.goto("/r#v2-e7-0")
  await expect(page.getByText(REPORT_COPY.partner.header)).toBeVisible()
  await expect(page.getByRole("button", { name: "리포트 보내기" })).toHaveCount(
    1,
  )
  await page.goto("/r?shared=1#v2-e7-0")
  await expect(page.getByRole("button", { name: "리포트 보내기" })).toHaveCount(
    0,
  )
  await expect(
    page.getByText("함께 자는 사람이 옆에서 보고 답한 리포트예요"),
  ).toBeVisible()
})
