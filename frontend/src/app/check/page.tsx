import { redirect } from "next/navigation"
import { CheckFlow } from "@/components/sleep/check-flow"
import { parseRole } from "@/lib/sleep-check"

export const metadata = { title: "3분 코골이 무료진단" }

// 경로는 랜딩의 첫 질문에서 고른다. 경로 없이 들어오면(옛 `?from=` 링크 포함) 랜딩으로 보낸다.
export default async function CheckPage(props: PageProps<"/check">) {
  const role = parseRole((await props.searchParams).for)
  if (!role) redirect("/")
  return <CheckFlow role={role} />
}
