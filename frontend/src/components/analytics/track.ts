declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
  }
}

type Event =
  | { name: "check_start" }
  | { name: "check_complete"; level: string }
  | { name: "share_click" }
  | {
      name: "clinic_click"
      hospital_id: string
      region: string
      target: "resmed" | "homepage" | "map"
    }
  | { name: "clinic_call"; hospital_id: string; region: string }
  | { name: "clinic_nearby"; result: "granted" | "denied" | "failed" }

// 메타에는 건강 정보(결과 단계)를 보내지 않는다. 체크 완료와 병원 연결만 전환으로 보낸다.
// 병원 링크와 전화는 같은 목적이라 메타가 한 이벤트로 최적화하도록 ClinicClick 하나로 보낸다.
// 이름은 기존 픽셀 기록·맞춤 전환과 이어지도록 바꾸지 않는다.
const PIXEL_EVENTS: Partial<Record<Event["name"], [string, string]>> = {
  check_complete: ["track", "Lead"],
  clinic_click: ["trackCustom", "ClinicClick"],
  clinic_call: ["trackCustom", "ClinicClick"],
}

// 메타 픽셀은 주소를 해시까지 그대로 보낸다(GA는 해시를 뺀다). 리포트 해시에는 응답이 있으니
// 해시가 있는 동안에는 픽셀을 부르지 않는다.
export function pixel(...args: unknown[]) {
  if (window.location.hash) return
  window.fbq?.(...args)
}

// 판정 단계와 리포트 출처를 이후 페이지뷰·병원 연결에도 붙이려고 사용자 속성으로 저장한다.
// 응답 자체는 보내지 않는다.
export function setReportUser(properties: {
  check_level: string
  report_source: "self" | "shared"
}) {
  window.gtag?.("set", "user_properties", properties)
}

export function track(event: Event) {
  const { name, ...params } = event
  // 이벤트보다 먼저 설정해야 check_complete에도 속성이 붙는다.
  if (event.name === "check_complete") {
    setReportUser({ check_level: event.level, report_source: "self" })
  }
  window.gtag?.("event", name, params)
  const pixelEvent = PIXEL_EVENTS[name]
  if (pixelEvent) pixel(...pixelEvent)
}
