import { ReportView } from "@/components/sleep/report-view"
import { parseRole } from "@/lib/sleep-check"

export const metadata = {
  title: "수면 진단 리포트",
  description: "옆에서 본 코골이, 병원에 가볼 만한지 알려드려요",
}

// 공유 링크와 경로 쿼리가 없는 옛 리포트 링크는 배우자가 답한 리포트로 연다.
export default async function ReportPage(props: PageProps<"/r">) {
  const { shared, for: role } = await props.searchParams
  const isShared = shared === "1"
  return (
    <ReportView
      shared={isShared}
      role={isShared ? "partner" : (parseRole(role) ?? "partner")}
    />
  )
}
