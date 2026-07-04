import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, ArrowRight } from "lucide-react";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Footer } from "@/components/layout/Footer";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

type Billing = "monthly" | "annual";

// 결제 연동 전: 가입(/auth)으로 보내 지불 의향(가입 전환)을 측정한다.
// 실제 결제 링크(토스페이먼츠/Stripe Payment Link)가 생기면 START_URL을 교체.
const START_URL = "/auth";

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  const proPrice = billing === "monthly" ? "₩12,000" : "₩10,000";
  const proUsd = billing === "monthly" ? "$9 / mo" : "$7.50 / mo";
  const proNote = billing === "annual" ? "연 ₩120,000 · $90 일괄 청구" : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <LandingHeader />

      {/* Hero */}
      <header className="text-center px-6 pt-16 pb-10 max-w-2xl mx-auto">
        <div className="font-mono text-xs uppercase tracking-widest text-primary mb-3">Pricing</div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
          수업에 맞는 요금제를<br />선택하세요
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          선생님 한 명이든 학교 전체든 — 나무는 당신의 한국어 수업 속도에 맞춰 자랍니다. 학생은 언제나 무료입니다.
        </p>

        {/* 월간/연간 토글 */}
        <div className="inline-flex items-center gap-1 mt-7 p-1 rounded-full border border-border bg-card">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${billing === "monthly" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            월간 결제
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${billing === "annual" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            연간 결제
            <span className={`text-[11px] font-bold ${billing === "annual" ? "text-white/90" : "text-primary"}`}>2개월 무료</span>
          </button>
        </div>
      </header>

      {/* 가격 카드 3개 */}
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl w-full mx-auto px-6 items-start">
        {/* 무료 */}
        <div className="rounded-2xl border border-border bg-card p-7 flex flex-col">
          <div className="text-lg font-bold text-foreground">무료</div>
          <div className="text-sm text-muted-foreground mt-1">처음 시작하는 선생님을 위한 체험판</div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold text-foreground">₩0</span>
            <span className="text-sm text-muted-foreground">/월</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">$0 / mo</div>
          <Link to={START_URL} className="mt-5 rounded-lg border border-border py-2.5 text-center text-sm font-semibold text-foreground hover:bg-accent transition-colors">
            무료로 시작
          </Link>
          <ul className="mt-6 space-y-2.5 text-sm">
            {["퀴즈 월 3개", "학생 최대 15명", "빈칸 채우기 유형", "AI 문제 생성 월 10회", "커뮤니티 지원"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro (가장 인기) */}
        <div className="relative rounded-2xl border-2 border-primary bg-card p-7 flex flex-col shadow-md md:-mt-2">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white">
            가장 인기
          </div>
          <div className="text-lg font-bold text-foreground">Pro</div>
          <div className="text-sm text-muted-foreground mt-1">개인 선생님을 위한 모든 기능</div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold text-foreground">{proPrice}</span>
            <span className="text-sm text-muted-foreground">/월</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">{proUsd}</div>
          {proNote && <div className="text-xs text-primary mt-1">{proNote}</div>}
          <Link to={START_URL} className="mt-5 rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white hover:bg-[#155237] transition-colors">
            Pro 시작하기
          </Link>
          <ul className="mt-6 space-y-2.5 text-sm">
            {["무제한 퀴즈", "학생 무제한", "빈칸 · 문장 · 말하기 전체 유형", "AI 문제 생성 무제한", "클래스 무제한 + 배정 · 공지", "오답노트 · 단어장", "성취도 분석 리포트"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>

        {/* 학교 · 기관 */}
        <div className="rounded-2xl border border-border bg-card p-7 flex flex-col">
          <div className="text-lg font-bold text-foreground">학교 · 기관</div>
          <div className="text-sm text-muted-foreground mt-1">여러 선생님과 통합 관리가 필요한 기관</div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">맞춤 견적</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">Custom pricing</div>
          <FeedbackButton
            context="pricing_enterprise"
            label="영업팀 문의"
            variant="outline"
            size="default"
            hideIcon
            className="mt-5 w-full justify-center"
          />
          <ul className="mt-6 space-y-2.5 text-sm">
            {["Pro의 모든 기능", "선생님 좌석 묶음 할인", "관리자 대시보드 · 통합 청구", "SSO · 계정 연동", "전담 온보딩 · 우선 지원"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 비교 표 */}
      <div className="max-w-4xl w-full mx-auto px-6 mt-20">
        <h2 className="text-xl font-bold text-foreground text-center mb-1.5">플랜 자세히 비교</h2>
        <p className="text-sm text-muted-foreground text-center mb-7">필요한 기능이 어느 플랜에 있는지 한눈에 확인하세요.</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-semibold text-foreground px-4 py-3">기능</th>
                <th className="font-semibold text-muted-foreground px-4 py-3">무료</th>
                <th className="font-semibold text-primary px-4 py-3 bg-primary/5">Pro</th>
                <th className="font-semibold text-muted-foreground px-4 py-3">학교 · 기관</th>
              </tr>
            </thead>
            <tbody>
              {([
                ["퀴즈 개수", "월 3개", "무제한", "무제한"],
                ["학생 수", "15명", "무제한", "무제한"],
                ["퀴즈 유형", "빈칸만", "빈칸 · 문장 · 말하기", "전체"],
                ["AI 문제 생성", "월 10회", "무제한", "무제한"],
                ["클래스 관리 · 공지", null, true, true],
                ["오답노트 · 단어장", null, true, true],
                ["성취도 분석 리포트", null, true, "고급"],
                ["관리자 대시보드", null, null, true],
                ["SSO · 통합 청구", null, null, true],
                ["지원", "커뮤니티", "이메일", "전담 매니저"],
              ] as [string, string | boolean | null, string | boolean | null, string | boolean | null][]).map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <th className="text-left font-medium text-foreground px-4 py-3">{row[0]}</th>
                  {[row[1], row[2], row[3]].map((cell, j) => (
                    <td key={j} className={`text-center px-4 py-3 ${j === 1 ? "bg-primary/5" : ""}`}>
                      {cell === true ? (
                        <Check className="h-4 w-4 text-primary mx-auto" />
                      ) : cell === null ? (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      ) : (
                        <span className={j === 1 ? "text-foreground font-medium" : "text-muted-foreground"}>{cell}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl w-full mx-auto px-6 mt-20">
        <h2 className="text-xl font-bold text-foreground text-center mb-7">자주 묻는 질문</h2>
        <div className="space-y-4">
          {[
            ["무료 플랜에 기간 제한이 있나요?", "아니요. 무료 플랜은 기간 제한 없이 계속 사용할 수 있습니다. 위 사용량 한도 안에서 자유롭게 쓰세요."],
            ["결제 주기를 중간에 바꿀 수 있나요?", "네. 언제든 월간 ↔ 연간, Pro ↔ 무료로 변경할 수 있고 차액은 자동으로 정산됩니다."],
            ["학생도 비용을 내야 하나요?", "아니요. 학생은 언제나 무료입니다. 결제는 선생님과 기관만 진행합니다."],
            ["학교 견적은 어떻게 받나요?", "‘영업팀 문의’를 누르시면 선생님 수와 학생 규모에 맞춘 견적을 영업일 기준 1일 내 보내드립니다."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold text-foreground">{q}</div>
              <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 최종 CTA */}
      <div className="max-w-4xl w-full mx-auto px-6 my-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#1E6B47] to-[#155237] text-white text-center px-8 py-14">
          <div className="text-2xl md:text-3xl font-bold">오늘 첫 퀴즈를 만들어보세요</div>
          <div className="text-white/80 mt-2">신용카드 없이 1분이면 시작할 수 있습니다.</div>
          <Link to={START_URL} className="inline-flex items-center gap-2 mt-7 rounded-xl bg-white px-6 py-3 font-bold text-primary hover:bg-white/90 transition-colors">
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
