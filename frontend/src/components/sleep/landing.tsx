import Link from "next/link"
import { PathChoice } from "@/components/sleep/path-choice"

const SPARKLE =
  "M0-10C1.5-3 3-1.5 10 0 3 1.5 1.5 3 0 10-1.5 3-3 1.5-10 0-3-1.5-1.5-3 0-10Z"

// 광고 소재의 달과 별을 작게 가져왔다. 광고에서 넘어온 사람이 같은 서비스로 알아보게 한다.
function Moon() {
  return (
    <svg viewBox="0 0 72 48" className="h-8 w-12 fill-primary" aria-hidden>
      <mask id="crescent">
        <rect width="72" height="48" fill="white" />
        <circle cx="55" cy="18" r="15" fill="black" />
      </mask>
      <circle cx="46" cy="24" r="18" mask="url(#crescent)" />
      <path d={SPARKLE} transform="translate(12 16) scale(0.8)" />
    </svg>
  )
}

export function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold text-muted-foreground">
          코골이체커
        </p>
        <Moon />
      </div>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight whitespace-pre-line">
        {"코골이,\n병원에 가볼 만할까요?"}
      </h1>
      <p className="mt-4 text-lg font-semibold text-balance text-primary">
        질문 9개에 답하면 바로 알려드려요
      </p>
      <h2 className="mt-12 text-xl font-semibold">
        누구의 코골이가 궁금하세요?
      </h2>
      <div className="mt-4">
        <PathChoice />
      </div>
      <div className="mt-auto pt-12 text-base text-muted-foreground">
        <p>무료 · 답은 어디에도 저장되지 않아요</p>
        <p className="flex flex-wrap items-center gap-x-2">
          <span>의사의 진단을 대신하지 않아요 ·</span>
          <Link
            href="/privacy"
            className="inline-flex min-h-12 items-center underline underline-offset-4"
          >
            개인정보처리방침
          </Link>
        </p>
      </div>
    </main>
  )
}
