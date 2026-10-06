"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { track } from "@/components/analytics/track"
import { QUESTIONS, judge, toReportHash, type Answer } from "@/lib/sleep-check"

const OPTIONS: { value: Answer; label: string }[] = [
  { value: "yes", label: "네" },
  { value: "no", label: "아니요" },
  { value: "unknown", label: "잘 모르겠어요" },
]

export function CheckFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [picked, setPicked] = useState<Answer | null>(null)
  const locked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)
  const rewound = useRef(false)
  const question = QUESTIONS[step]
  const total = QUESTIONS.length
  const selected = picked ?? answers[question.id]

  // 단계마다 history 항목을 하나씩 쌓아 휴대폰 뒤로 가기가 이전 질문으로 가게 한다.
  // 첫 질문은 원래 항목을 쓰므로 쌓인 항목 수는 늘 지금 단계 번호와 같다.
  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      locked.current = false
      setPicked(null)
      const restored = event.state?.step
      setStep(typeof restored === "number" ? restored : 0)
    }
    window.addEventListener("popstate", onPopState)
    // 리포트에서 돌아오거나 새로고침하면 답이 사라진 채 중간 단계 항목에 있다.
    // 쌓인 항목을 첫 질문까지 되감아 처음부터 다시 시작한다.
    // 개발 모드에서 effect가 두 번 돌아도 한 번만 되감도록 ref로 막는다.
    const leftover = window.history.state?.step
    if (!rewound.current && typeof leftover === "number" && leftover > 0) {
      window.history.go(-leftover)
    }
    rewound.current = true
    return () => {
      window.removeEventListener("popstate", onPopState)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // 화면 읽기 프로그램이 새 질문을 읽도록 단계가 바뀌면 질문으로 초점을 옮긴다.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    heading.current?.focus()
  }, [step])

  // 고른 답을 잠깐 보여준 뒤 넘어간다. 바로 넘어가면 눌렸는지 알기 어렵다.
  // 상태는 다시 그려진 뒤에야 바뀌어서, 연달아 누른 두 번째 답은 ref로 막는다.
  // 마지막 문항은 리포트로 이동하므로 잠금을 풀지 않는다.
  function pick(value: Answer) {
    if (locked.current) return
    locked.current = true
    setPicked(value)
    timer.current = setTimeout(() => {
      timer.current = null
      setPicked(null)
      if (step + 1 < total) locked.current = false
      answer(value)
    }, 200)
  }

  // popstate가 오기 전에 예약된 답이 다음 질문으로 넘기지 않도록 먼저 끊는다.
  function goBack() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    window.history.back()
  }

  function answer(value: Answer) {
    if (Object.keys(answers).length === 0) track({ name: "check_start" })
    const next = { ...answers, [question.id]: value }
    setAnswers(next)
    if (step + 1 < total) {
      window.history.pushState({ step: step + 1 }, "")
      setStep(step + 1)
      return
    }
    const signals = QUESTIONS.filter((q) => next[q.id] === "yes")
    const unknowns = QUESTIONS.filter((q) => next[q.id] === "unknown")
    track({ name: "check_complete", level: judge(signals) })
    router.push(`/r#${toReportHash({ signals, unknowns })}`)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-md flex-col px-4">
      <div className="flex min-h-14 items-center">
        {step > 0 && (
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-12"
            aria-label="이전 질문으로 가기"
            onClick={goBack}
          >
            <ArrowLeft className="size-6" />
          </Button>
        )}
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="진행 상황"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={step + 1}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((step + 1) / total) * 100}%` }}
        />
      </div>
      <p className="mt-6 text-base text-muted-foreground tabular-nums">
        {step + 1} / {total} · 남편을 옆에서 본 대로 답해 주세요
      </p>
      <div
        key={step}
        className="animate-in duration-200 fade-in slide-in-from-right-2 motion-reduce:animate-none"
      >
        {/* 코드로만 초점을 받는 제목이라 누를 것처럼 보이지 않게 링을 숨긴다. 조작 요소의 포커스 링 규칙과는 다르다. */}
        <h1
          ref={heading}
          tabIndex={-1}
          className="mt-2 text-2xl font-bold outline-none"
        >
          {question.text.partner}
        </h1>
        <div className="mt-8 flex flex-col gap-3">
          {OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selected === option.value ? "default" : "outline"}
              size="cta"
              className="w-full justify-start px-4 py-3 text-left"
              onClick={() => pick(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </main>
  )
}
