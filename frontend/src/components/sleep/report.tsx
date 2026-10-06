import { AlertCircle, Check, Triangle } from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  LEVEL_COPY,
  MODERATE_MIN,
  QUESTIONS,
  REPORT_COPY,
  STRONG_QUESTIONS,
  TOO_EARLY_COPY,
  type Level,
  type Question,
  type Role,
} from "@/lib/sleep-check"
import { cn } from "cn"

// 약한 단계부터 순서대로 보여준다. 공유 미리보기 이미지처럼 3칸 막대로 정도를 보여준다.
// 노랑은 주요 버튼 색이라 쓰지 않고, 초록 → 코랄 → 빨강으로 강해진다.
const LEVELS: { level: Level; fill: string }[] = [
  { level: "weak", fill: "bg-success" },
  { level: "moderate", fill: "bg-warning" },
  { level: "strong", fill: "bg-danger" },
]

// 검진 결과지처럼 척도 전체를 옅게 이어 깔고 현재 단계만 진하게 표시한다.
// 현재까지 채우면 "검사 권유"에서 세 칸이 다 켜져 어디인지 안 읽혀서 위치 표시로 바꿨다.
// 색만으로 전하지 않도록 위에 ▼, 아래에 단계 이름을 둔다.
function LevelMeter({ level }: { level: Level }) {
  const current = LEVELS.findIndex((item) => item.level === level)

  return (
    <div
      className="flex flex-col gap-2"
      role="img"
      aria-label={`3단계 중 ${current + 1}단계, ${LEVEL_COPY[level].chip}`}
    >
      <div className="grid grid-cols-3" aria-hidden>
        {LEVELS.map((item, index) => (
          <div key={item.level} className="flex justify-center">
            {index === current && (
              <Triangle className="size-3 rotate-180 fill-foreground text-foreground" />
            )}
          </div>
        ))}
      </div>
      <div
        className="grid h-3 grid-cols-3 overflow-hidden rounded-full"
        aria-hidden
      >
        {LEVELS.map((item, index) => (
          <div
            key={item.level}
            className={cn(item.fill, index !== current && "opacity-40")}
          />
        ))}
      </div>
      <ol className="grid grid-cols-3 gap-2 text-center text-base" aria-hidden>
        {LEVELS.map((item, index) => (
          <li
            key={item.level}
            className={cn(
              index === current
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {LEVEL_COPY[item.level].chip}
          </li>
        ))}
      </ol>
    </div>
  )
}

// 잠이 닿아 있는 영역별로 묶는다. 치료 효과가 확인된 것만 넣는다(출처 아코디언 참고).
// 효과는 사람마다 달라서 모든 줄을 "~수 있어요"로 맞춘다. 연구 성격은 카드 아래 출처 줄에서 밝힌다.
// 일반인이 바로 읽을 수 있는 숫자가 원문에 있는 항목(두통, 운전, 화장실)만 숫자를 넣는다.
// 졸림·기분·성기능은 척도 점수만 있어 숫자를 넣지 않는다. 혈압은 평균 2~3mmHg로 작아 "조금"으로 둔다.
// 관계(다툼)는 직접 근거가 없어 뺐다.
const SELF_BENEFITS: { area: string; text: string }[] = [
  { area: "잠", text: "밤새 깨지 않고 푹 잘 수 있어요" },
  { area: "머리", text: "낮에 덜 졸리고 집중이 잘 될 수 있어요" },
  { area: "두통", text: "아침 두통을 겪는 비율이 53%에서 16%로 줄 수 있어요" },
  { area: "기분", text: "우울감이 개선되고 짜증이 줄 수 있어요" },
  { area: "운전", text: "사고 위험이 약 70% 줄 수 있어요" },
  { area: "혈압", text: "혈압이 조금 내려갈 수 있어요" },
  {
    area: "화장실",
    text: "밤에 깨서 가는 횟수가 2.5번에서 1번 아래로 줄 수 있어요",
  },
  { area: "성기능", text: "성기능이 개선될 수 있어요" },
]

const STEPS = [
  { title: "수면클리닉에서 진료 상담받기" },
  {
    title: "병원에서 하룻밤 자면서 검사받기(수면다원검사)",
    note: "금요일·토요일 밤에 하는 곳도 있어요",
  },
  { title: "결과 듣고 치료 방법 정하기" },
]

function ReportCard({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <Card className="text-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          <h2>{title}</h2>
        </CardTitle>
        {note && (
          <CardDescription className="text-base">{note}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

type Bar = { label: string; value: number; display: string }

// 두 값만 비교하는 막대라 숫자를 막대 끝에 바로 적고 범례는 두지 않는다.
function CompareBars({
  bars,
  max,
  tone,
  summary,
}: {
  bars: [Bar, Bar]
  max: number
  tone: "warning" | "primary"
  summary: string
}) {
  return (
    <div className="flex flex-col gap-2" role="img" aria-label={summary}>
      {bars.map((bar, index) => {
        const emphasis = index === 1
        return (
          <div
            key={bar.label}
            className="grid grid-cols-[minmax(4.5rem,auto)_1fr_auto] items-center gap-2 text-base"
          >
            <span className={cn(!emphasis && "text-muted-foreground")}>
              {bar.label}
            </span>
            <div
              className={cn(
                "h-5 rounded-r-sm",
                emphasis
                  ? tone === "warning"
                    ? "bg-warning"
                    : "bg-primary"
                  : "bg-muted-foreground/30",
              )}
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
            <span
              className={cn(
                "text-right font-semibold tabular-nums",
                !emphasis && "font-normal text-muted-foreground",
              )}
            >
              {bar.display}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Source({ children }: { children: React.ReactNode }) {
  return <p className="text-base text-muted-foreground">{children}</p>
}

export function Report({
  level,
  signals,
  tooEarly,
  shared,
  role,
}: {
  level: Level
  signals: Question[]
  tooEarly: boolean
  shared: boolean
  role: Role
}) {
  const copy = tooEarly
    ? { ...LEVEL_COPY[level], ...TOO_EARLY_COPY[role] }
    : LEVEL_COPY[level]

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <p className="text-base text-muted-foreground tabular-nums">
          {shared
            ? "함께 자는 사람이 옆에서 보고 답한 리포트예요"
            : REPORT_COPY[role].header}
        </p>
        <div className="flex flex-col gap-3">
          {shared && level !== "weak" && (
            <p className="text-lg font-semibold text-primary">
              요즘 낮에 졸리고 피곤했다면,
              <br />
              수면무호흡증 때문일 수 있어요
            </p>
          )}
          <LevelMeter level={level} />
          <h1 className="text-2xl font-bold whitespace-pre-line">
            {copy.title}
          </h1>
          <p className="text-lg text-muted-foreground">{copy.body}</p>
          <p className="text-lg text-muted-foreground">
            수면무호흡증은 자는 동안 숨이 반복해서 멈추거나 얕아지는 병이에요.
            코골이와 함께 나타나는 경우가 많고, 본인은 자는 중이라 잘 몰라요.
          </p>
        </div>
      </header>

      <ReportCard
        title={REPORT_COPY[role].signalsTitle}
        note={`${QUESTIONS.length}개 중 ${signals.length}개`}
      >
        {signals.length === 0 ? (
          <p className="text-muted-foreground">“네”라고 답한 신호가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {signals.map((signal) => (
              <li key={signal.id} className="flex items-start gap-2">
                {signal.strong ? (
                  <AlertCircle
                    className="mt-1 size-5 shrink-0 text-warning"
                    aria-hidden
                  />
                ) : (
                  <Check
                    className="mt-1 size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
                {/* 글자를 키우면 옆에 둔 칩이 본문을 밀어내서 칩을 본문 아래에 둔다. */}
                <span className="flex flex-1 flex-col">
                  {signal.text[role]}
                  {signal.strong && (
                    <span className="text-base font-semibold text-warning">
                      주요 신호
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportCard>

      {level !== "weak" && (
        <ReportCard title="자는 동안 이런 일이 생겨요">
          <p className="tabular-nums">
            숨이 멈출 때마다 뇌가 잠깐 깨요. 심한 편이면{" "}
            <strong className="font-semibold">
              한 시간에 15번, 하룻밤에 100번 넘게 깨요.
            </strong>{" "}
            본인은 기억하지 못하지만 깊은 잠에 들지 못해서 8시간을 자도
            피곤해요.
          </p>
          <Source>중등도 수면무호흡증 진단 기준 (Kapur 2017)</Source>
        </ReportCard>
      )}

      {/* 신호가 적은 사람에게 위험 수치를 보여주면 겁주기로 읽힌다. "자는 동안" 카드와 같은 기준으로 숨긴다. */}
      {level !== "weak" && (
        <>
          <ReportCard title="치료하지 않으면">
            <p className="font-semibold">교통사고 위험이 2.4배 높아요</p>
            <CompareBars
              tone="warning"
              max={2.4}
              summary="교통사고 위험: 일반인 1, 치료하지 않은 수면무호흡증 2.4배"
              bars={[
                { label: "일반인", value: 1, display: "1" },
                { label: "치료 안 함", value: 2.4, display: "2.4배" },
              ]}
            />
            <Source>메타분석 (Tregear 2009)</Source>
            <p className="mt-3 font-semibold">
              심한 경우 심혈관 질환(뇌졸중·심근경색) 위험이 2.9배 높았어요
            </p>
            <CompareBars
              tone="warning"
              max={2.9}
              summary="심혈관 질환(뇌졸중·심근경색) 위험: 일반인 1, 심한데 치료하지 않으면 2.9배"
              bars={[
                { label: "일반인", value: 1, display: "1" },
                { label: "심한데 치료 안 함", value: 2.9, display: "2.9배" },
              ]}
            />
            <Source>남성 대상 관찰 연구 (Marin 2005)</Source>
          </ReportCard>

          <ReportCard title="치료하면">
            <p className="text-lg font-semibold text-primary">
              잠이 달라지면 삶이 달라져요
            </p>
            <dl className="grid grid-cols-[minmax(3.5rem,auto)_1fr] gap-x-3 gap-y-2">
              {SELF_BENEFITS.map((group) => (
                <div
                  key={group.area}
                  className="col-span-2 grid grid-cols-subgrid"
                >
                  <dt className="font-semibold text-muted-foreground">
                    {group.area}
                  </dt>
                  <dd>{group.text}</dd>
                </div>
              ))}
            </dl>
            <Source>
              사고 위험 Tregear 2010 · 아침 두통 Seo 2023 · 화장실 Margel 2006,
              모두 치료 전후 비교 연구
            </Source>
            <Separator className="my-1" />
            <p className="font-semibold">함께 자는 사람도 더 잘 자요</p>
            <p className="text-muted-foreground">
              코골이 소리에 깨지 않고 잘 수 있어요.
            </p>
            <CompareBars
              tone="primary"
              max={100}
              summary="함께 자는 사람의 수면 효율: 치료 전 74%, 치료 후 87%"
              bars={[
                { label: "치료 전", value: 74, display: "74%" },
                { label: "치료 후", value: 87, display: "87%" },
              ]}
            />
            <Source>
              함께 자는 사람의 수면 효율(누워 있는 시간 중 실제로 잔 시간) ·
              부부 10쌍 소규모 연구 (Beninati 1999)
            </Source>
          </ReportCard>
        </>
      )}

      <ReportCard
        title="검사는 이렇게 받아요"
        note="검사비는 건강보험 적용 후 약 12~14만 원이에요"
      >
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-base tabular-nums">
                {index + 1}
              </span>
              <span className="flex flex-col">
                {step.title}
                {step.note && (
                  <span className="text-base text-muted-foreground">
                    {step.note}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </ReportCard>

      <footer className="flex flex-col gap-2">
        <Accordion className="gap-2">
          <AccordionItem value="criteria">
            <AccordionTrigger className="min-h-12 items-center py-3 text-lg">
              판단 기준
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              <ul className="flex list-disc flex-col gap-1 pl-4">
                <li>
                  병원에서 수면무호흡증을 가려낼 때 쓰는 질문(STOP-Bang)을
                  바탕으로 만들었어요. {REPORT_COPY[role].basis}
                </li>
                <li>
                  숨 멈춤과 헐떡임은 미국수면학회가 꼽는 주요 증상이에요.{" "}
                  {STRONG_QUESTIONS.map((q) => q.short).join(", ")} 중 하나라도
                  있으면 “{LEVEL_COPY.strong.chip}”예요.
                </li>
                <li>
                  그 외 신호가 {MODERATE_MIN}개 이상이면 “
                  {LEVEL_COPY.moderate.chip}”, 그보다 적으면 “
                  {LEVEL_COPY.weak.chip}”이에요.
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="sources">
            <AccordionTrigger className="min-h-12 items-center py-3 text-lg">
              출처
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              교통사고 위험 Tregear 2009(JCSM) 메타분석, 심혈관 Marin
              2005(Lancet), 함께 자는 사람의 수면 효율 Beninati 1999(Mayo Clin
              Proc, 10쌍), 낮 졸림 Giles 2006(Cochrane, 무작위 시험 메타분석),
              혈압 Bratton 2015(JAMA, 무작위 시험 메타분석), 치료 후 사고 위험
              Tregear 2010(Sleep, 치료 전후 비교 연구 9개), 기분 Povitz
              2014(PLoS Med, 무작위 시험 메타분석), 아침 두통 Seo 2023(Sci Rep,
              국내 116명 관찰 연구), 야간뇨 Margel 2006(Urology, 97명 치료 전후
              비교), 성기능 Yang 2021(Clin Respir J, 메타분석), 증상·진단 기준
              Kapur 2017(JCSM)
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <p className="text-base text-muted-foreground">
          이 리포트는 의사의 진단을 대신하지 않아요. 정확한 것은 병원 진료로
          확인하세요.
        </p>
        <Link
          href="/privacy"
          className="flex min-h-12 items-center text-base text-muted-foreground underline underline-offset-4"
        >
          개인정보처리방침 보기
        </Link>
      </footer>
    </article>
  )
}
