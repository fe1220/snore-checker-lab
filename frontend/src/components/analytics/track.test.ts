import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { setReportUser, track } from "./track"

describe("track", () => {
  let gtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    gtag = vi.fn()
    vi.stubGlobal("window", { gtag, location: { hash: "" } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("체크 완료 때 판정 단계를 사용자 속성으로 먼저 설정한다", () => {
    track({ name: "check_complete", level: "strong" })

    expect(gtag.mock.calls).toEqual([
      [
        "set",
        "user_properties",
        { check_level: "strong", report_source: "self" },
      ],
      ["event", "check_complete", { level: "strong" }],
    ])
  })

  it("다른 이벤트는 사용자 속성을 설정하지 않는다", () => {
    track({ name: "check_start" })
    track({ name: "share_click" })

    expect(gtag.mock.calls).toEqual([
      ["event", "check_start", {}],
      ["event", "share_click", {}],
    ])
  })

  it("공유받은 리포트 속성을 그대로 사용자 속성으로 설정한다", () => {
    setReportUser({ check_level: "weak", report_source: "shared" })

    expect(gtag.mock.calls).toEqual([
      [
        "set",
        "user_properties",
        { check_level: "weak", report_source: "shared" },
      ],
    ])
  })
})
