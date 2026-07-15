import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, ArrowRight } from "lucide-react";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Footer } from "@/components/layout/Footer";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";

type Billing = "monthly" | "annual";

// ─────────────────────────────────────────────────────────────────────────────
// 🅿️ 파킹 중 (2026-07, 체험 기간 동안 비공개)
//
// 이 파일은 라우트에서 빠져 있어 어디서도 import되지 않는다. 살아있는 코드가
// 아니라 "구독제 시작할 때 되살릴 초안"이다. 지우지 말 것.
//
// [왜 숨겼나]
// 이 페이지가 두 목적을 동시에 하려다 둘 다 못 하고 있었다.
//  - "지금 뭘 받는지" 안내로 보면 → 틀렸다. 체험 기간이라 전원이 월 10개인데
//    (이제 하드코딩이 아니라 DB의 `plan_limits` 행: free = (quiz_limit 10, period 'month').
//     예전엔 generate-quiz의 MONTHLY_LIMIT = 10 상수였다)
//    이 페이지는 "월 3개"라고 겁을 준다. 마음껏 써보게 하고 싶은 시기에
//    제품을 실제보다 빡빡해 보이게 만든다.
//  - "지불 의향 측정"(아래 START_URL 주석의 원래 의도)으로 보면 → 보여줄 건
//    미래 가격이지 지금 한도가 아니다.
// 게다가 결제 연동이 없어 모든 버튼이 /auth로만 간다. 팔 것 자체가 없다.
//
// [공개할 때 할 일]
// 1. 라우트·링크 복구
//    - src/App.tsx — `import Pricing from "./pages/Pricing";` + `/pricing` Route
//      (현재 Route 자리에 파킹 주석이 있다)
//    - src/components/layout/LandingHeader.tsx — 네비의 `<Link to="/pricing">요금</Link>`
//      (기능/도움말 사이에 있었다)
//    - src/pages/Index.tsx — CTA Band의 "요금 보기 →" 버튼 + 안내 문구.
//      현재 문구는 플랜을 언급하지 않는 "지금은 모든 기능을 무료로 쓸 수 있어요."로
//      바뀌어 있고, 버튼 컨테이너도 1개 기준(`flex justify-center`)으로 줄어 있다.
//      버튼을 되살리면 `flex flex-wrap justify-center gap-3`으로 되돌릴 것.
//
// 2. 숫자를 DB에서 읽도록 연동 (하드코딩 금지)
//    한도의 단일 소스로 `plan_limits` 테이블이 신설된다 (plan, quiz_limit, period).
//    아래 지점의 하드코딩을 거기서 읽어야 또 어긋나지 않는다.
//    (줄번호는 금방 어긋나므로 문자열로 찾을 것)
//    - 무료 카드 기능 목록의 `"퀴즈 월 3개"`
//    - 비교표 행 `["퀴즈 개수", "월 3개", "무제한", "무제한"]`
//    - FAQ의 `"한도는 매월 1일에 초기화돼요"` ← 이것도 *기간*에 묶여 있다.
//      free가 (1, 'week')가 되면 이 문장은 거짓이 된다. 숫자와 함께 동적으로.
//    - 비로그인 마케팅 페이지라 fetch 실패 시 빈 값이 보이면 안 된다.
//      반드시 하드코딩 폴백을 둘 것.
//
// 3. 학생 수 한도는 강제 로직이 전무하다.
//    무료 카드의 `"학생 최대 15명"`, 비교표의 `["학생 수", "15명", ...]` 두 곳.
//    지키지 못할 약속이므로 공개 전에 강제하든 문구를 빼든 결론을 낼 것.
//
// [유지 사항] 무료 플랜 확대 문구(6유형 전체·오답노트·클래스 관리 등)는 미래 정책
// 그대로다. 가격 값, 월간/연간 토글, START_URL, FeedbackButton 모두 그대로 둔다.
// FeedbackButton context="pricing_enterprise" 유입은 파킹 동안 끊기지만,
// src/pages/AdminDashboard.tsx 의 라벨은 기존 데이터 표시를 위해 남겨뒀다.
// ─────────────────────────────────────────────────────────────────────────────

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
          <div className="text-sm text-muted-foreground mt-1">소규모 수업이라면 이대로 충분해요</div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold text-foreground">₩0</span>
            <span className="text-sm text-muted-foreground">/월</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground mt-1">$0 / mo</div>
          <Link to={START_URL} className="mt-5 rounded-lg border border-border py-2.5 text-center text-sm font-semibold text-foreground hover:bg-accent transition-colors">
            무료로 시작
          </Link>
          <ul className="mt-6 space-y-2.5 text-sm">
            {["퀴즈 월 3개", "학생 최대 15명", "6가지 퀴즈 유형 전체", "클래스 관리 · 공지", "오답노트 · 단어장", "기본 성취도 리포트", "커뮤니티 지원"].map((f) => (
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
            {["무료의 모든 기능", "퀴즈 무제한", "학생 · 클래스 무제한", "상세 성취도 분석 리포트", "이메일 우선 지원"].map((f) => (
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
                ["퀴즈 유형", "6가지 전체", "6가지 전체", "6가지 전체"],
                ["클래스 관리 · 공지", true, true, true],
                ["오답노트 · 단어장", true, true, true],
                ["성취도 분석 리포트", "기본", "상세", "고급"],
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
            ["무료 한도를 넘으면 어떻게 되나요?", "그 달에는 새 퀴즈 생성만 잠시 멈추고, 이미 만든 퀴즈와 학생 결과는 계속 쓸 수 있습니다. 한도는 매월 1일에 초기화돼요."],
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
