import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Footer } from "@/components/layout/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { searchHelp } from "@/lib/help/search";
import { ARTICLES, CATEGORY_GROUPS, POPULAR, STUDENT_FAQ, TEACHER_FAQ, type HelpRole } from "@/data/help";
import { HelpHero } from "@/components/help/HelpHero";
import { HelpSearchResults } from "@/components/help/HelpSearchResults";
import { HelpPopularCard } from "@/components/help/HelpPopularCard";
import { HelpCategoryCard } from "@/components/help/HelpCategoryCard";
import { HelpQuizTypeGrid } from "@/components/help/HelpQuizTypeGrid";
import { HelpFaqList } from "@/components/help/HelpFaqList";
import { HelpContactCta } from "@/components/help/HelpContactCta";

function normalizeRole(value: string | null): HelpRole | null {
  return value === "teacher" || value === "student" ? value : null;
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-primary">{eyebrow}</div>
      )}
      <h2 className="text-[22px] font-black tracking-tight text-foreground break-keep">{title}</h2>
      {subtitle && <p className="mt-1 text-[15px] text-muted-foreground break-keep">{subtitle}</p>}
    </div>
  );
}

function HomeSection({ children }: { children: ReactNode }) {
  return (
    <section className="border-t border-border bg-card py-16 md:py-20">
      <div className="container max-w-5xl">{children}</div>
    </section>
  );
}

function HelpHomeSkeleton() {
  return (
    <section className="border-t border-border bg-card py-16 md:py-20">
      <div className="container max-w-5xl">
        <Skeleton className="mb-6 h-7 w-48" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HelpCenter() {
  useDocumentMeta({
    title: "도움말",
    description: "나무 Korean 도움말 센터 — 선생님과 학생을 위한 사용법을 검색하고 둘러보세요.",
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { role: authRole, loading: authLoading } = useAuth();
  const roleFixedRef = useRef(false);

  const urlRole = normalizeRole(searchParams.get("role"));
  const qParam = searchParams.get("q") ?? "";
  const [draft, setDraft] = useState(qParam);

  // URL이 바깥에서(뒤로가기 등) 바뀌면 draft를 동기화한다.
  useEffect(() => {
    setDraft(qParam);
  }, [qParam]);

  // role이 URL에 없고 auth 로딩이 끝나면, 딱 한 번 ref 가드로 URL에 고정한다.
  useEffect(() => {
    if (roleFixedRef.current) return;
    if (urlRole) {
      roleFixedRef.current = true;
      return;
    }
    if (authLoading) return;
    roleFixedRef.current = true;
    const resolvedRole: HelpRole = authRole === "student" ? "student" : "teacher";
    const next = new URLSearchParams(searchParams);
    next.set("role", resolvedRole);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authRole, urlRole]);

  // 검색어는 로컬 state + 150ms 디바운스로 URL에 반영한다. 한글 IME 조합 중
  // 글자가 끊기는 문제를 피하려면 순수 URL-only 상태로 두면 안 된다.
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (draft === current) return;
      const next = new URLSearchParams(searchParams);
      if (draft.trim()) next.set("q", draft);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    }, 150);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const role = urlRole;
  const roleReady = role !== null;

  const handleRoleChange = (nextRole: HelpRole) => {
    roleFixedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.set("role", nextRole);
    // 역할 토글 시 검색어는 유지한다(검색은 전역이라 역할 변경은 정렬만 바꾼다).
    setSearchParams(next, { replace: true });
  };

  const hasQuery = draft.trim().length > 0;
  const results = hasQuery ? searchHelp(draft, role ?? "teacher") : { articles: [], faqs: [] };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <LandingHeader />
      <main className="flex-1">
        <HelpHero
          draft={draft}
          onDraftChange={setDraft}
          role={role}
          onRoleChange={handleRoleChange}
          roleReady={roleReady}
        />

        {hasQuery ? (
          <HelpSearchResults query={draft} articles={results.articles} faqs={results.faqs} />
        ) : !roleReady ? (
          <HelpHomeSkeleton />
        ) : (
          <>
            <HomeSection>
              <SectionHeading eyebrow="POPULAR" title="자주 찾는 문서" />
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {POPULAR[role].map((id) => (
                  <HelpPopularCard key={id} article={ARTICLES[id]} />
                ))}
              </div>
            </HomeSection>

            <section className="border-t border-border bg-background py-16 md:py-20">
              <div className="container max-w-5xl">
                <SectionHeading
                  title={role === "teacher" ? "선생님 도움말 주제" : "학생 도움말 주제"}
                  subtitle="주제별 도움말을 클릭하면 자세한 안내를 볼 수 있어요."
                />
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {CATEGORY_GROUPS[role].map((category) => (
                    <HelpCategoryCard key={category.key} category={category} />
                  ))}
                </div>
              </div>
            </section>

            {role === "student" && (
              <HomeSection>
                <SectionHeading title="퀴즈 유형 한눈에 보기" subtitle="화면 상단 안내에 따라 유형별로 풀면 됩니다." />
                <HelpQuizTypeGrid />
              </HomeSection>
            )}

            <section className="border-t border-border bg-background py-16 md:py-20">
              <div className="container max-w-3xl">
                <SectionHeading title="자주 묻는 질문" />
                <HelpFaqList faqs={role === "teacher" ? TEACHER_FAQ : STUDENT_FAQ} />
              </div>
            </section>
          </>
        )}

        <HelpContactCta />
      </main>
      <Footer />
    </div>
  );
}
