import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, Users, Sparkles, CheckCircle, GraduationCap } from 'lucide-react';

export default function Index() {
  const { user, role } = useAuth();

  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-2 md:mb-6 animate-fade-in break-keep">
              <span className="block">문장을 통해서 완성하는</span>
            </h1>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in break-keep">
              <span className="block gradient-text">달콤한 한국어</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in animation-delay-150 break-keep">
              단어장만 외우는 지루한 공부는 이제 그만.<br className="hidden md:block" />
              생생한 문장 속에서 단어의 진짜 쓰임을 익히고, 퀴즈로 즐겁게 확인해보세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in animation-delay-300">
              {user ? (
                <Link to="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    대시보드로 이동
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth?mode=signup">
                    <Button size="lg" className="w-full sm:w-auto">
                      무료로 시작하기
                    </Button>
                  </Link>
                  <Link to="/quiz/example">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      퀴즈 맛보기
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-3">
            <span className="text-primary">달콤한국어</span>, 
          </h2>
          <h2 className="text-3xl font-bold text-center mb-12">
            <span> 무엇이 다를까요?</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-2xl p-8 shadow-sm card-hover">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">문장으로 배우는 진짜 한국어</h3>
              <p className="text-muted-foreground break-keep">
                단어의 뜻은 문장 안에서 살아납니다. 다양한 예문으로 어휘의 뉘앙스까지 익히세요.
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 shadow-sm card-hover">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                <BookOpen className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3">나를 위한 맞춤형 문장</h3>
              <p className="text-muted-foreground break-keep">
                나의 수준과 관심사에 딱 맞는 문장들을 매일 새롭게 만날 수 있습니다.
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 shadow-sm card-hover">
              <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3">전 세계 언어 지원</h3>
              <p className="text-muted-foreground break-keep">
                모르는 단어가 나와도 걱정 마세요. 11개 언어 번역이 학습을 도와드립니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-3xl p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <GraduationCap className="h-8 w-8 text-primary" />
                <h3 className="text-2xl font-bold">선생님을 위한 스마트한 도구</h3>
              </div>
              <ul className="space-y-4">
                {['단어 목록으로 퀴즈 자동 생성', '학생 맞춤형 예문 자동 생성', '클래스 생성 및 학생 관리', '학생에게 퀴즈 전송 및 결과 확인'].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-accent/5 to-accent/10 rounded-3xl p-8 md:p-12">
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-8 w-8 text-accent" />
                <h3 className="text-2xl font-bold">학생을 위한 즐거운 학습</h3>
              </div>
              <ul className="space-y-4">
                {['선생님이 보낸 퀴즈 풀기', '모국어 번역 힌트 제공', '학습 기록 및 오답노트', '클래스 참여로 체계적 학습'].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            지금 바로 문장으로 시작하세요
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto break-keep">
            무료로 가입하고 문장으로 배우는 진짜 한국어를 경험해보세요.
          </p>
          <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
            <Button size="lg" variant="secondary">
              {user ? "대시보드로 이동" : "무료로 시작하기"}
            </Button>
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
