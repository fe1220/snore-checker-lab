"use client"

import Link from "next/link"
import { useEffect, useSyncExternalStore } from "react"
import { setReportUser } from "@/components/analytics/track"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Report } from "@/components/sleep/report"
import { ShareButton } from "@/components/sleep/share-button"
import {
  fromReportHash,
  isTooEarly,
  judge,
  toReportHash,
  type Role,
} from "@/lib/sleep-check"
import { cn } from "cn"

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

// 응답은 해시에만 있어서 서버에서는 읽을 수 없다. 서버 렌더링 동안은 null로 두고 Skeleton을 보여준다.
function useHash() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => null,
  )
}

export function ReportView({ shared, role }: { shared: boolean; role: Role }) {
  const hash = useHash()

  // 공유받은 리포트를 연 사람도 판정 단계별로 볼 수 있게 출처를 붙여 저장한다. 해시는 보내지 않는다.
  useEffect(() => {
    if (!shared || hash === null) return
    const answers = fromReportHash(hash)
    if (!answers) return
    setReportUser({
      check_level: judge(answers.signals),
      report_source: "shared",
    })
  }, [shared, hash])

  if (hash === null) return <ReportSkeleton />

  const answers = fromReportHash(hash)
  if (!answers) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">리포트를 찾을 수 없어요</h1>
        <p className="text-lg text-muted-foreground">
          주소가 잘렸거나 잘못 복사됐어요.
        </p>
        <Link href="/" className={cn(buttonVariants({ size: "cta" }), "px-6")}>
          {shared ? "진단하기" : "다시 진단하기"}
        </Link>
      </main>
    )
  }

  const level = judge(answers.signals)
  const sharePath = `/r?shared=1#${toReportHash(answers)}`

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col">
      <div className="flex-1 px-4 pt-6 pb-8">
        <Report
          level={level}
          signals={answers.signals}
          tooEarly={isTooEarly(level, answers.unknowns)}
          shared={shared}
          role={role}
        />
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t bg-background p-4">
        <Link
          href="/clinics"
          className={cn(buttonVariants({ size: "cta" }), "w-full")}
        >
          근처 수면클리닉 찾기
        </Link>
        {/* 당사자는 본인이 병원에 갈 사람이라 공유가 다음 행동이 아니다. 공유 링크는 배우자 경로에서만 만든다. */}
        {!shared && role === "partner" && <ShareButton path={sharePath} />}
      </div>
    </main>
  )
}

function ReportSkeleton() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col gap-6 px-4 pt-6"
      aria-busy
      aria-label="리포트를 불러오는 중"
    >
      <Skeleton className="h-4 w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </main>
  )
}
