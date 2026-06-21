import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Bookmark, ChevronRight } from "lucide-react";

export default function QuizShare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [teacherName, setTeacherName] = useState<string>("");
  const [remainingAttempts, setRemainingAttempts] = useState<number>(0);
  const [anonymousName, setAnonymousName] = useState("");
  const [sentenceCount, setSentenceCount] = useState(0);
  const [recordingCount, setRecordingCount] = useState(0);


  useEffect(() => {
    if (user?.user_metadata?.name) {
      setAnonymousName(user.user_metadata.name);
    }
  }, [user]);

  useEffect(() => {
    loadSharedQuiz();
  }, [token]);

  const loadSharedQuiz = async () => {
    try {
      // 1. Load share info
      const { data: shareData, error: shareError } = await supabase
        .from("quiz_shares")
        .select("*")
        .eq("share_token", token)
        .single();

      if (shareError || !shareData) {
        setError("유효하지 않은 링크입니다");
        setIsLoading(false);
        return;
      }

      // 2. Check expiration
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        setError("만료된 링크입니다");
        setIsLoading(false);
        return;
      }

      // 3. Check attempt limit
      const maxAttempts = shareData.max_attempts || 3;
      const completionCount = shareData.completion_count || 0;
      const remaining = maxAttempts - completionCount;
      
      if (remaining <= 0) {
        setError("응시 가능 횟수를 초과했습니다");
        setIsLoading(false);
        return;
      }
      
      setRemainingAttempts(remaining);

      // 4. Increment view count
      await supabase
        .from("quiz_shares")
        .update({ view_count: shareData.view_count + 1 })
        .eq("id", shareData.id);

      // 5. Load quiz
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", shareData.quiz_id)
        .single();

      if (quizError || !quizData) {
        setError("퀴즈를 불러올 수 없습니다");
        setIsLoading(false);
        return;
      }

      // 6. Load teacher name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", quizData.teacher_id)
        .single();

      const [{ count: sc }, { count: rc }] = await Promise.all([
        supabase.from("sentence_making_problems").select("*", { count: "exact", head: true }).eq("quiz_id", shareData.quiz_id),
        supabase.from("recording_problems").select("*", { count: "exact", head: true }).eq("quiz_id", shareData.quiz_id),
      ]);
      setSentenceCount(sc ?? 0);
      setRecordingCount(rc ?? 0);

      setQuiz(quizData);
      setTeacherName(profileData?.name || "선생님");
      setIsLoading(false);
    } catch (error) {
      console.error("Load error:", error);
      setError("오류가 발생했습니다");
      setIsLoading(false);
    }
  };

  const startQuiz = () => {
    // Navigate to existing quiz take page with share token and name
    navigate(`/quiz/${quiz.id}/take?share=${token}&name=${encodeURIComponent(anonymousName.trim())}`);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const typeChips = [
    { label: "빈칸 채우기", count: `${quiz.problems.length}문제`, show: true },
    { label: "문장 만들기", count: `${sentenceCount}문제`, show: !!quiz.sentence_making_enabled },
    { label: "말하기 연습", count: `${recordingCount}문제`, show: !!quiz.recording_enabled },
  ].filter((t) => t.show);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[456px] flex flex-col items-center">
          {/* 브랜드 */}
          <img src="/Namu_logo_text_right.png" className="h-16 w-auto mb-6" alt="나무 Korean" />

          {/* 퀴즈 카드 */}
          <div className="w-full bg-card border border-border rounded-2xl shadow-md overflow-hidden">
            {/* 그라데이션 헤더 */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1E6B47] to-[#155237] text-white px-7 py-6">
              <div className="flex items-center gap-2 text-sm opacity-90 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-[11px] font-bold">
                  {teacherName.charAt(0)}
                </span>
                <span><span className="font-semibold">{teacherName}</span>님이 보낸 퀴즈</span>
              </div>
              <h1 className="font-bold text-[27px] leading-tight">{quiz.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-3.5">
                <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-primary">
                  {quiz.difficulty}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">
                  문제 {quiz.problems.length + (quiz.sentence_making_enabled ? sentenceCount : 0) + (quiz.recording_enabled ? recordingCount : 0)}개
                </span>
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">
                  남은 응시 {remainingAttempts}회
                </span>
              </div>
            </div>

            {/* 본문 */}
            <div className="px-7 pt-6 pb-7">
              {typeChips.length > 1 && (
                <div className="flex gap-2 mb-5">
                  {typeChips.map((t) => (
                    <div key={t.label} className="flex-1 flex flex-col items-center gap-1.5 py-3 px-2 border border-border rounded-xl text-center">
                      <div className="text-[13px] font-bold text-foreground whitespace-nowrap">{t.label}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{t.count}</div>
                    </div>
                  ))}
                </div>
              )}

              {user ? (
                <div className="text-center space-y-1 mb-2">
                  <p className="font-medium text-lg">
                    <span className="text-primary">{user.user_metadata.name}</span>님으로 참여합니다
                  </p>
                  <p className="text-sm text-muted-foreground">준비되셨나요?</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[12.5px] font-semibold text-foreground mb-1.5">
                    이름을 입력하고 시작하세요
                  </label>
                  <input
                    type="text"
                    value={anonymousName}
                    onChange={(e) => setAnonymousName(e.target.value)}
                    placeholder="예) 이서연"
                    className="w-full h-[46px] px-3.5 rounded-[10px] border border-border bg-card text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  {anonymousName.trim().length > 0 && anonymousName.trim().length < 2 && (
                    <p className="text-xs text-destructive mt-1">이름은 2글자 이상 입력해주세요</p>
                  )}
                </div>
              )}

              <button
                onClick={startQuiz}
                disabled={!user && (!anonymousName.trim() || anonymousName.trim().length < 2)}
                className="w-full mt-4 h-[50px] rounded-[11px] bg-primary text-white font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(30,107,71,.24)] hover:bg-[#155237] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                퀴즈 시작하기
              </button>

              <p className="text-xs text-muted-foreground text-center mt-3.5 leading-relaxed">
                내 답안은 <span className="font-medium text-foreground">{teacherName}</span> 선생님이 볼 수 있어요.
              </p>
            </div>
          </div>

          {/* 학생 전환 배너 (게스트만) */}
          {!user && (
            <Link
              to="/auth?mode=signup"
              className="w-full mt-4 flex items-center gap-2.5 px-4 py-3.5 rounded-xl border border-dashed border-border bg-card hover:bg-accent transition-colors"
            >
              <Bookmark className="h-5 w-5 text-primary shrink-0" />
              <span className="text-[13px] text-muted-foreground leading-snug">
                <span className="font-semibold text-foreground">가입하면</span> 점수와 오답을 저장할 수 있어요.
              </span>
              <span className="ml-auto flex items-center gap-0.5 text-[13px] font-semibold text-primary whitespace-nowrap">
                학생으로 가입 <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
