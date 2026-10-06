import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

// 리포트 해시: 문항 9개 전부(e7), 약한 신호 3개(3n), 신호 없음(0). lib/sleep-check.ts의 비트 순서를 따른다.
// 질문과 리포트는 경로(self·partner)마다 문구 길이가 달라 두 경로를 모두 잰다.
const SCREENS: {
  name: string
  path: string
  open?: string
  answer?: string
}[] = [
  { name: "s1-start", path: "/" },
  { name: "s2-self", path: "/check?for=self" },
  { name: "s2-partner", path: "/check?for=partner" },
  // 2번 질문부터 뒤로 가기 버튼이 "이전 질문"으로 바뀐다.
  { name: "s2-self-back", path: "/check?for=self", answer: "아니요" },
  { name: "s2-partner-back", path: "/check?for=partner", answer: "아니요" },
  { name: "s3-self-strong", path: "/r?for=self#v2-e7-0" },
  { name: "s3-partner-strong", path: "/r?for=partner#v2-e7-0" },
  { name: "s3-self-moderate", path: "/r?for=self#v2-3n-0" },
  { name: "s3-partner-moderate", path: "/r?for=partner#v2-3n-0" },
  { name: "s3-self-weak", path: "/r?for=self#v2-0-0" },
  { name: "s3-partner-weak", path: "/r?for=partner#v2-0-0" },
  // 주요 신호 3문항(비트 4+8+16=28)을 모름 → 36진수 "s"
  { name: "s3-self-too-early", path: "/r?for=self#v2-0-s" },
  { name: "s3-partner-too-early", path: "/r?for=partner#v2-0-s" },
  // 경로 쿼리가 없는 옛 리포트 링크(v1 포함)는 배우자 기준으로 연다.
  { name: "s3-legacy-v1", path: "/r#v1-e7" },
  { name: "s3-shared", path: "/r?shared=1#v1-e7" },
  // 해시를 읽지 못한 리포트(찾을 수 없음 상태)
  { name: "s3-bad", path: "/r#bad" },
  { name: "s4-clinics", path: "/clinics" },
  { name: "s4-regions", path: "/clinics", open: "전국 ·" },
  { name: "privacy", path: "/privacy" },
  { name: "not-found", path: "/nope" },
  // error.tsx는 빌드된 앱에서 렌더 오류를 일으킬 방법이 없어 뺀다.
]

const MIN_FONT = 16
const MIN_TARGET = 48
const MIN_GAP = 8

async function open(page: Page, screen: (typeof SCREENS)[number]) {
  await page.goto(screen.path)
  await page.waitForLoadState("networkidle")
  if (screen.answer) {
    await page.getByRole("button", { name: screen.answer, exact: true }).click()
    await page.getByRole("button", { name: /이전 질문/ }).waitFor()
  }
  if (screen.open) {
    await page.getByRole("button", { name: new RegExp(screen.open) }).click()
    await page.getByRole("dialog").waitFor()
  }
  // 화면 밖 병원 카드는 content-visibility로 그리기를 건너뛰어, axe가 색을 계산하는 시점에 따라
  // 대비 위반으로 잘못 잡힌다. 사용자는 스크롤하면 모두 보게 되니 전부 그린 상태에서 잰다.
  await page.addStyleTag({
    content: ".offscreen-skip { content-visibility: visible !important; }",
  })
  // 전환 효과가 끝난 뒤에 잰다. 도중에 재면 크기가 조금 작게 나온다.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished)),
  )
}

// 글자만 키운다(안드로이드 글꼴 배율과 같다). 여백과 고정 높이는 그대로라 넘침이 드러난다.
async function scaleText(page: Page, scale: number) {
  await page.evaluate((s) => {
    const all = [...document.querySelectorAll<HTMLElement>("body *")]
    const sizes = all.map((el) => parseFloat(getComputedStyle(el).fontSize))
    all.forEach((el, i) => (el.style.fontSize = `${sizes[i] * s}px`))
  }, scale)
}

function smallText(page: Page, min: number) {
  return page.evaluate((minSize) => {
    const found: string[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (!text || !el) continue
      if (el.closest("script, style, noscript, [aria-hidden='true']")) continue
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (rect.width <= 1 || rect.height <= 1 || style.visibility === "hidden")
        continue
      const size = parseFloat(style.fontSize)
      if (size < minSize) found.push(`${size}px "${text.slice(0, 30)}"`)
    }
    return found
  }, min)
}

// 문장 안의 글자 링크(display: inline)는 터치 영역 검사에서 뺀다.
// 시트가 열려 있으면 뒤에 가려진 화면은 누를 수 없으니 시트 안만 잰다.
function targets(page: Page) {
  return page.evaluate(() =>
    [
      ...(
        document.querySelector<HTMLElement>("[role='dialog']") ?? document
      ).querySelectorAll<HTMLElement>("a[href], button, [role='button']"),
    ]
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "inline"
        )
      })
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(el)
        const inner = range.getBoundingClientRect()
        return {
          label: (el.getAttribute("aria-label") ?? el.innerText)
            .trim()
            .slice(0, 30),
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
          spill:
            inner.width > 0 &&
            (inner.left < rect.left - 1 ||
              inner.right > rect.right + 1 ||
              inner.top < rect.top - 1 ||
              inner.bottom > rect.bottom + 1),
        }
      }),
  )
}

type Target = Awaited<ReturnType<typeof targets>>[number]

function tooClose(list: Target[]) {
  const found: string[] = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      const sameRow = gapY < 0 && gapX >= 0 && gapX < MIN_GAP
      const sameColumn = gapX < 0 && gapY >= 0 && gapY < MIN_GAP
      if (sameRow || sameColumn)
        found.push(`"${a.label}" ↔ "${b.label}" ${Math.max(gapX, gapY)}px`)
    }
  }
  return found
}

// 카드처럼 넘치는 부분을 숨기는 상자 밖으로 나간 글자를 찾는다. 가로 스크롤은 없는데 글자가 잘리는 경우다.
function clippedText(page: Page) {
  return page.evaluate(() => {
    const found: string[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (
        !text ||
        !el ||
        el.closest("[aria-hidden='true'], [role='progressbar']")
      )
        continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0) continue
      for (let box = el.parentElement; box; box = box.parentElement) {
        if (getComputedStyle(box).overflowX === "visible") continue
        const limit = box.getBoundingClientRect()
        if (rect.right > limit.right + 1 || rect.left < limit.left - 1)
          found.push(`"${text.slice(0, 20)}"`)
        break
      }
    }
    return found
  })
}

function hasHorizontalScroll(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    // 병원 744곳을 한 번에 그리는 화면은 axe·대비 검사만 20초 안팎 걸려 병렬 실행에서 기본 30초를 넘는다.
    if (screen.path === "/clinics") test.slow()

    test("글자가 16px 이상이다", async ({ page }) => {
      await open(page, screen)
      expect(await smallText(page, MIN_FONT)).toEqual([])
    })

    test("터치 영역이 48px 이상이고 8px 이상 떨어져 있다", async ({ page }) => {
      await open(page, screen)
      const list = await targets(page)
      const small = list
        .filter((t) => t.w < MIN_TARGET || t.h < MIN_TARGET)
        .map((t) => `"${t.label}" ${Math.round(t.w)}×${Math.round(t.h)}`)
      expect(small).toEqual([])
      expect(tooClose(list)).toEqual([])
    })

    test("글자 대비가 7:1 이상이다", async ({ page }) => {
      await open(page, screen)
      const result = await new AxeBuilder({ page })
        .withRules(["color-contrast-enhanced"])
        .analyze()
      const found = result.violations.flatMap((v) =>
        v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary}`),
      )
      expect(found).toEqual([])
    })

    test("axe 기본 규칙 위반이 없다", async ({ page }) => {
      await open(page, screen)
      const result = await new AxeBuilder({ page }).analyze()
      const found = result.violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id} ${n.target.join(" ")}`),
      )
      expect(found).toEqual([])
    })

    test("폭 320px에서 가로 스크롤이 없다", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 })
      await open(page, screen)
      expect(await hasHorizontalScroll(page)).toBe(false)
    })

    for (const width of [375, 320]) {
      for (const scale of [1.3, 2]) {
        test(`폭 ${width}px, 글자 ${scale * 100}%에서 넘치거나 잘리지 않는다`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 812 })
          await open(page, screen)
          await scaleText(page, scale)
          expect(await hasHorizontalScroll(page)).toBe(false)
          const spilled = (await targets(page))
            .filter((t) => t.spill)
            .map((t) => t.label)
          expect(spilled).toEqual([])
          expect(await clippedText(page)).toEqual([])
        })
      }
    }
  })
}

// 랜딩 카드는 카드 전체가 누르는 영역이라 일반 버튼보다 큰 88px을 지킨다(ux-spec S1).
test.describe("s1 경로 카드", () => {
  const MIN_CARD = 88
  for (const width of [375, 320]) {
    for (const scale of [1, 2]) {
      test(`폭 ${width}px, 글자 ${scale * 100}%에서 카드 두 장이 88px 이상이고 겹치지 않는다`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 812 })
        await open(page, { name: "s1-start", path: "/" })
        if (scale !== 1) await scaleText(page, scale)
        const cards = page.getByRole("button", {
          name: /^(내 코골이|함께 자는 사람의 코골이)/,
        })
        await expect(cards).toHaveCount(2)
        const boxes = await cards.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect()
            return { top: r.top, bottom: r.bottom, h: r.height, w: r.width }
          }),
        )
        for (const box of boxes) {
          expect(box.h).toBeGreaterThanOrEqual(MIN_CARD)
          expect(box.w).toBeGreaterThanOrEqual(MIN_TARGET)
        }
        expect(boxes[1].top - boxes[0].bottom).toBeGreaterThanOrEqual(MIN_GAP)
      })
    }
  }
})

// A11Y_SHOTS=1일 때만 스크린샷을 남긴다. 검증 문서에 붙이는 용도다.
test.describe("스크린샷", () => {
  test.skip(!process.env.A11Y_SHOTS, "A11Y_SHOTS=1일 때만 실행")
  for (const screen of SCREENS) {
    for (const width of [320, 375]) {
      for (const scale of [1, 1.3, 2]) {
        test(`${screen.name} ${width}px ${scale * 100}%`, async ({ page }) => {
          await page.setViewportSize({ width, height: 812 })
          await open(page, screen)
          if (scale !== 1) await scaleText(page, scale)
          await page.screenshot({
            path: `../docs/work/02-a11y-copy/screenshots/${screen.name}-${width}-${scale * 100}.png`,
            fullPage: !screen.name.startsWith("s4"),
          })
        })
      }
    }
  }
})
