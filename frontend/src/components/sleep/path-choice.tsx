"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { track } from "@/components/analytics/track"
import { cn } from "cn"
import type { Role } from "@/lib/sleep-check"

const CHOICES: { role: Role; title: string; body: string }[] = [
  {
    role: "self",
    title: "내 코골이",
    body: "코 곤다는 말을 듣거나, 자고 나도 피곤해요",
  },
  {
    role: "partner",
    title: "함께 자는 사람의 코골이",
    body: "옆에서 코 고는 소리나 숨 멈춤을 봐요",
  },
]

export function PathChoice() {
  const router = useRouter()
  const [picked, setPicked] = useState<Role | null>(null)
  const locked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // 질문 답 버튼과 같이 고른 카드를 200ms 보여준 뒤 넘어간다.
  // 상태는 다시 그려진 뒤에야 바뀌어서, 연달아 누른 두 번째 카드는 ref로 막는다.
  function pick(role: Role) {
    if (locked.current) return
    locked.current = true
    setPicked(role)
    track({ name: "check_start", role })
    timer.current = setTimeout(() => {
      timer.current = null
      router.push(`/check?for=${role}`)
    }, 200)
  }

  return (
    <div className="flex flex-col gap-3">
      {CHOICES.map((choice) => (
        <button
          key={choice.role}
          type="button"
          onClick={() => pick(choice.role)}
          className={cn(
            "flex min-h-22 w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            picked === choice.role ? "border-primary" : "border-border",
          )}
        >
          <span className="flex flex-1 flex-col gap-1">
            <span className="text-lg font-semibold">{choice.title}</span>
            <span className="text-base text-muted-foreground">
              {choice.body}
            </span>
          </span>
          <ChevronRight className="size-6 shrink-0 text-primary" aria-hidden />
        </button>
      ))}
    </div>
  )
}
