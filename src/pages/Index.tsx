import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LandingHeader } from '@/components/layout/LandingHeader';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, Layers, Users, ArrowRight } from 'lucide-react';
import { HeroProductMock } from '@/components/landing/HeroProductMock';

export default function Index() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        {/* ── Hero (split) ── */}
        <section className="bg-background">
          <div className="container py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              {/* Left: copy + CTA */}
              <div className="lg:col-span-5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-semibold mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  수업에 집중하세요, 퀴즈는 AI가
                </div>

                <h1 className="font-brand font-black text-4xl md:text-5xl leading-[1.15] tracking-tight text-foreground mb-5 break-keep">
                  퀴즈 만드는 데<br />
                  <span className="text-primary">10초면 충분해요.</span>
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md break-keep">
                  단어만 입력하면 빈칸·문장·말하기 퀴즈가{" "}
                  <strong className="text-foreground font-semibold">10초 안에</strong> 만들어집니다.
                  학생들에게 바로 공유하고 결과까지 한눈에 볼 수 있어요.
                </p>

                <div className="flex gap-3 mb-6">
                  {user ? (
                    <Link to="/dashboard">
                      <Button size="lg" className="gap-2">
                        대시보드로 이동 <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/auth?mode=signup" className="flex-1 sm:flex-none">
                        <Button size="lg" className="gap-2 w-full sm:w-auto">
                          무료로 시작하기 <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link to="/quiz/example" className="flex-1 sm:flex-none">
                        <Button variant="outline" size="lg" className="w-full sm:w-auto">
                          퀴즈 맛보기
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-ui">
                  <span>✓ 회원가입만 하면 무료</span>
                  <span>✓ AI가 예문·문제 생성</span>
                  <span>✓ 채점 자동, 결과 즉시 확인</span>
                </div>

                {!user && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    학생이신가요?{" "}
                    <Link to="/auth?mode=signup" className="text-primary underline hover:text-primary/80">
                      학생으로 가입하기
                    </Link>
                  </p>
                )}
              </div>

              {/* Right: product mock */}
              <div className="lg:col-span-7">
                <HeroProductMock />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-20 bg-card border-t border-border">
          <div className="container max-w-5xl">
            <div className="mb-12">
              <div className="text-xs font-ui font-bold text-primary tracking-[0.1em] uppercase mb-3">FEATURES</div>
              <h2 className="font-brand font-black text-3xl leading-tight tracking-tight text-foreground">
                수업 준비에서 채점까지,<br />한 도구로.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: <Sparkles className="w-5 h-5" />,
                  title: "AI가 문제를 만듭니다",
                  desc: "단어만 입력하면 끝. 빈칸·문장·말하기 세 가지 유형을 동시에 생성합니다.",
                  stat: "평균 10초",
                },
                {
                  icon: <Layers className="w-5 h-5" />,
                  title: "한 곳에서 모든 유형",
                  desc: "읽기·쓰기·말하기를 한 클래스 안에서. 학생 수준과 관심사에 맞춘 예문 톤.",
                  stat: "3가지 퀴즈",
                },
                {
                  icon: <Users className="w-5 h-5" />,
                  title: "클래스와 진척, 자동 정리",
                  desc: "학생은 회원가입 후 초대 코드로 클래스 가입. 누가 어디서 막혔는지 즉시 확인.",
                  stat: "학생 무제한",
                },
              ].map((f, i) => (
                <div key={i} className="bg-background border border-border rounded-2xl p-7 flex flex-col">
                  <div className="w-10 h-10 rounded-[10px] bg-accent text-primary flex items-center justify-center mb-5">
                    {f.icon}
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2 leading-snug">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4 break-keep">{f.desc}</p>
                  <div className="text-xs font-mono font-semibold text-primary pt-3 border-t border-dashed border-border">
                    {f.stat}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Band ── */}
        <section className="bg-primary text-primary-foreground py-16 text-center">
          <div className="container">
            <h2 className="font-brand font-black text-2xl md:text-3xl tracking-tight mb-3">
              오늘 과제, 10초 만에 끝내세요
            </h2>
            <p className="text-primary-foreground/80 text-base mb-7 max-w-md mx-auto break-keep">
              구독 없이도 매월 일정량까지 무료. 필요할 때 더 쓰세요.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
                <Button variant="secondary" size="lg" className="font-bold">
                  {user ? "대시보드로 이동" : "지금 무료 시작"}
                </Button>
              </Link>
              <Link to="#features">
                <Button variant="outline" size="lg" className="bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
                  요금 보기 →
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
