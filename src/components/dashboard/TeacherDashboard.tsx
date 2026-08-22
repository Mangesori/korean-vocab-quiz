import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { BaseStage, STAGE_ORDER, isStageEnabled } from "@/types/quiz";

// 스테이지 → quiz_results의 점수 컬럼. StudentDashboard.tsx의 이어풀기 판정과 동일한 규칙 —
// "완료"의 기준이 화면마다 다르면 학생 쪽에서는 진행 중인데 선생님 쪽에서는 미제출로 보인다.
const STAGE_SCORE_KEY: Record<BaseStage, string> = {
  matchup: "matchup_score",
  type_answer: "type_answer_score",
  fill_blank: "fill_blank_score",
  word_magnet: "word_magnet_score",
  sentence_making: "sentence_making_score",
  recording: "recording_score",
};

function asRow(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function stageScore(result: Record<string, unknown>, stage: BaseStage): number | null {
  const value = result[STAGE_SCORE_KEY[stage]];
  return typeof value === "number" ? value : null;
}

function isResultComplete(quiz: Record<string, unknown>, result: Record<string, unknown>): boolean {
  return STAGE_ORDER.every((stage) => !isStageEnabled(stage, quiz) || stageScore(result, stage) !== null);
}

// "2시간 전" / "어제" / "N일 전" — date-fns formatDistanceToNow는 "1일 전"이라 시안과 다르다.
function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 1) return "방금 전";
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "어제";
  return `${diffDays}일 전`;
}

const initials = (name: string) => name.slice(0, 2);

interface ResultRow {
  id: string;
  quiz_id: string;
  student_id: string | null;
  score: number;
  total_questions: number;
  completed_at: string;
  viewed_at: string | null;
  fill_blank_score: number | null;
  matchup_score: number | null;
  type_answer_score: number | null;
  word_magnet_score: number | null;
  sentence_making_score: number | null;
  recording_score: number | null;
}

interface QuizRow {
  id: string;
  title: string;
  difficulty: string;
  created_at: string;
  fill_blank_enabled: boolean | null;
  matchup_enabled: boolean | null;
  type_answer_enabled: boolean | null;
  word_magnet_enabled: boolean | null;
  sentence_making_enabled: boolean;
  recording_enabled: boolean;
}

interface HeroResultRow {
  id: string;
  quizId: string;
  quizTitle: string;
  studentName: string;
  score: number;
  total: number;
  completedAt: string;
}

interface PendingRow {
  studentId: string;
  studentName: string;
  quizId: string;
  quizTitle: string;
  assignedAt: string;
}

interface RecentQuizRow {
  id: string;
  title: string;
  difficulty: string;
}

interface ActiveClassRow {
  id: string;
  name: string;
  avgScore: number;
  lastActivity: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pasteWords, setPasteWords] = useState("");

  const { data } = useQuery({
    queryKey: ["teacherDashboard", user?.id],
    queryFn: async () => {
      const teacherId = user!.id;

      const [{ data: profileData }, { data: classesData }] = await Promise.all([
        supabase.from("profiles").select("name").eq("user_id", teacherId).single(),
        supabase
          .from("classes")
          .select("id, name, invite_code, created_at")
          .eq("teacher_id", teacherId)
          .order("created_at", { ascending: false }),
      ]);

      const classIds = (classesData ?? []).map((c) => c.id);

      const { data: membersData } = classIds.length
        ? await supabase.from("class_members").select("class_id, student_id").in("class_id", classIds)
        : { data: [] as { class_id: string; student_id: string }[] };

      const { data: quizzesData } = await supabase
        .from("quizzes")
        .select(
          "id, title, difficulty, created_at, fill_blank_enabled, matchup_enabled, type_answer_enabled, word_magnet_enabled, sentence_making_enabled, recording_enabled"
        )
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });

      const quizzes = (quizzesData ?? []) as QuizRow[];
      const quizIds = quizzes.map((q) => q.id);
      const quizMap = new Map(quizzes.map((q) => [q.id, q]));

      const { data: assignmentsData } = quizIds.length
        ? await supabase
            .from("quiz_assignments")
            .select("id, quiz_id, class_id, student_id, assigned_at")
            .in("quiz_id", quizIds)
        : { data: [] as { id: string; quiz_id: string; class_id: string | null; student_id: string | null; assigned_at: string }[] };

      const { data: resultsData } = quizIds.length
        ? await supabase
            .from("quiz_results")
            .select(
              "id, quiz_id, student_id, score, total_questions, completed_at, viewed_at, fill_blank_score, matchup_score, type_answer_score, word_magnet_score, sentence_making_score, recording_score"
            )
            .in("quiz_id", quizIds)
            .not("student_id", "is", null)
        : { data: [] as ResultRow[] };
      const results = (resultsData ?? []) as ResultRow[];

      // class_id -> 소속 학생 id 목록 (class_id로 배정된 건 반 전체 학생에게 적용된다)
      const membersByClass = new Map<string, string[]>();
      (membersData ?? []).forEach((m) => {
        const arr = membersByClass.get(m.class_id) ?? [];
        arr.push(m.student_id);
        membersByClass.set(m.class_id, arr);
      });

      const studentIdsInClasses = [...new Set((membersData ?? []).map((m) => m.student_id))];

      const allStudentIds = new Set<string>([
        ...studentIdsInClasses,
        ...(assignmentsData ?? []).map((a) => a.student_id).filter((v): v is string => !!v),
        ...results.map((r) => r.student_id).filter((v): v is string => !!v),
      ]);

      const { data: profilesData } = allStudentIds.size
        ? await supabase.from("profiles").select("user_id, name").in("user_id", [...allStudentIds])
        : { data: [] as { user_id: string; name: string }[] };
      const nameById = new Map((profilesData ?? []).map((p) => [p.user_id, p.name]));

      // ── 확인할 결과 (미확인 = viewed_at null) ────────────────────────────
      const unviewed = results
        .filter((r) => !r.viewed_at)
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

      const toHeroRow = (r: ResultRow): HeroResultRow => ({
        id: r.id,
        quizId: r.quiz_id,
        quizTitle: quizMap.get(r.quiz_id)?.title ?? "",
        studentName: nameById.get(r.student_id!) ?? "알 수 없음",
        score: r.score,
        total: r.total_questions,
        completedAt: r.completed_at,
      });

      const heroResults = unviewed.slice(0, 3).map(toHeroRow);

      // ── 최근 결과 (2c 전용) — 확인 여부와 무관하게 최신순 ──────────────
      const recentResults = [...results]
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
        .slice(0, 3)
        .map(toHeroRow);

      // ── 아직 안 푼 학생 ───────────────────────────────────────────────
      // class_id 배정은 반 전체 학생에게, student_id 배정은 그 학생에게만 적용된다.
      type Pair = { studentId: string; quizId: string; assignedAt: string };
      const pairs: Pair[] = [];
      (assignmentsData ?? []).forEach((a) => {
        if (a.student_id) {
          pairs.push({ studentId: a.student_id, quizId: a.quiz_id, assignedAt: a.assigned_at });
        } else if (a.class_id) {
          (membersByClass.get(a.class_id) ?? []).forEach((studentId) =>
            pairs.push({ studentId, quizId: a.quiz_id, assignedAt: a.assigned_at })
          );
        }
      });

      // 같은 (학생, 퀴즈)가 여러 경로로 중복 배정될 수 있어 가장 이른 배정일만 남긴다.
      const pairMap = new Map<string, Pair>();
      pairs.forEach((p) => {
        const key = `${p.studentId}:${p.quizId}`;
        const existing = pairMap.get(key);
        if (!existing || new Date(p.assignedAt) < new Date(existing.assignedAt)) pairMap.set(key, p);
      });

      const resultsByStudentQuiz = new Map<string, ResultRow[]>();
      results.forEach((r) => {
        if (!r.student_id) return;
        const key = `${r.student_id}:${r.quiz_id}`;
        const arr = resultsByStudentQuiz.get(key) ?? [];
        arr.push(r);
        resultsByStudentQuiz.set(key, arr);
      });

      // 학생당 가장 오래 방치된 미제출 배정 하나만 남긴다 (시안이 학생당 한 줄).
      const pendingByStudent = new Map<string, PendingRow>();
      for (const p of pairMap.values()) {
        const quiz = quizMap.get(p.quizId);
        if (!quiz) continue;
        const key = `${p.studentId}:${p.quizId}`;
        const hasComplete = (resultsByStudentQuiz.get(key) ?? []).some(
          (r) => new Date(r.completed_at) > new Date(p.assignedAt) && isResultComplete(asRow(quiz), asRow(r))
        );
        if (hasComplete) continue;

        const existing = pendingByStudent.get(p.studentId);
        if (!existing || new Date(p.assignedAt) < new Date(existing.assignedAt)) {
          pendingByStudent.set(p.studentId, {
            studentId: p.studentId,
            studentName: nameById.get(p.studentId) ?? "알 수 없음",
            quizId: p.quizId,
            quizTitle: quiz.title,
            assignedAt: p.assignedAt,
          });
        }
      }

      const pendingList = [...pendingByStudent.values()].sort(
        (a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()
      );

      // ── 최근 활동 클래스 ─────────────────────────────────────────────
      const resultsByStudent = new Map<string, ResultRow[]>();
      results.forEach((r) => {
        if (!r.student_id) return;
        const arr = resultsByStudent.get(r.student_id) ?? [];
        arr.push(r);
        resultsByStudent.set(r.student_id, arr);
      });

      const recentActiveClasses: ActiveClassRow[] = (classesData ?? [])
        .map((c) => {
          const classResults = (membersByClass.get(c.id) ?? []).flatMap((sid) => resultsByStudent.get(sid) ?? []);
          if (classResults.length === 0) return null;
          const avgScore = Math.round(
            classResults.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0) / classResults.length
          );
          const lastActivity = classResults.reduce(
            (latest, r) => (new Date(r.completed_at) > new Date(latest) ? r.completed_at : latest),
            classResults[0].completed_at
          );
          return { id: c.id, name: c.name, avgScore, lastActivity };
        })
        .filter((c): c is ActiveClassRow => c !== null)
        .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
        .slice(0, 3);

      const recentQuizzes: RecentQuizRow[] = quizzes.slice(0, 3).map((q) => ({
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
      }));

      return {
        teacherName: profileData?.name || null,
        stats: {
          totalClasses: classesData?.length ?? 0,
          totalStudents: studentIdsInClasses.length,
          totalQuizzes: quizzes.length,
        },
        unviewedCount: unviewed.length,
        heroResults,
        recentResults,
        pendingCount: pendingList.length,
        pendingStudents: pendingList.slice(0, 3),
        recentQuizzes,
        recentActiveClasses,
      };
    },
    enabled: !!user,
  });

  const stats = data?.stats ?? { totalClasses: 0, totalStudents: 0, totalQuizzes: 0 };
  const unviewedCount = data?.unviewedCount ?? 0;
  const heroResults = data?.heroResults ?? [];
  const recentResults = data?.recentResults ?? [];
  const pendingCount = data?.pendingCount ?? 0;
  const pendingStudents = data?.pendingStudents ?? [];
  const recentQuizzes = data?.recentQuizzes ?? [];
  const recentActiveClasses = data?.recentActiveClasses ?? [];

  const displayName = data?.teacherName || user?.email?.split("@")[0] || "";
  const todayLabel = format(new Date(), "yyyy년 M월 d일 EEEE", { locale: ko });
  const noQuizzesNoClasses = stats.totalQuizzes === 0 && stats.totalClasses === 0;
  const allCaughtUp = !noQuizzesNoClasses && unviewedCount === 0;

  const handleRemind = async (row: PendingRow) => {
    const { error } = await supabase.from("notifications").insert({
      user_id: row.studentId,
      type: "quiz_assigned",
      title: "퀴즈 알림",
      message: `"${row.quizTitle}" 퀴즈가 아직 남아있어요`,
      from_user_id: user!.id,
      quiz_id: row.quizId,
    });
    if (error) toast.error("알림을 보내지 못했습니다");
    else toast.success("재알림을 보냈습니다");
  };

  const handleCreateFromPaste = () => {
    if (!pasteWords.trim()) {
      toast.error("단어를 입력해주세요");
      return;
    }
    navigate("/quiz/create", { state: { initialWords: pasteWords } });
  };

  const resultScoreColor = (score: number, total: number) => (total > 0 && score / total >= 0.8 ? "#1E6B47" : "#B4552D");

  // ── 아직 안 푼 학생 카드 (2a·2c 공통) ───────────────────────────────
  const pendingCard = pendingCount > 0 && (
    <div className="bg-white border border-[#EBE5DE] rounded-2xl p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[14.5px] font-bold tracking-[-0.2px]">
          아직 안 푼 학생 <span className="text-[#B4552D]">{pendingCount}명</span>
        </div>
        <Link to="/classes" className="text-xs font-semibold text-primary">
          전체 배정 보기 →
        </Link>
      </div>
      <div className="mt-3.5 flex flex-col">
        {pendingStudents.map((p) => (
          <div key={p.studentId} className="flex items-center gap-3 py-3 border-t border-[#F2EDE7]">
            <div className="w-[26px] h-[26px] rounded-full bg-[#F3F0EA] grid place-items-center text-[10.5px] font-bold text-[#6B6460] shrink-0">
              {initials(p.studentName)}
            </div>
            <div className="flex-1 min-w-0 text-[13px] font-semibold">{p.studentName}</div>
            <div className="text-xs text-[#8A837D] whitespace-nowrap">
              {p.quizTitle} · {relativeTime(p.assignedAt)} 배정
            </div>
            <button
              onClick={() => handleRemind(p)}
              className="border border-[#E3DCD3] text-[#4A443F] text-[11.5px] font-semibold rounded-lg px-3 py-1.5 shrink-0"
            >
              재알림
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 오른쪽 레일 (2a·2c 공통) ─────────────────────────────────────────
  const rail = (
    <div className="flex flex-col gap-3">
      <Link
        to="/quiz/create"
        className="bg-primary rounded-2xl px-[18px] py-[15px] text-white flex items-center gap-2.5"
      >
        <Plus className="w-[17px] h-[17px]" strokeWidth={2.2} />
        <div>
          <div className="text-[13.5px] font-bold">새 퀴즈 만들기</div>
          <div className="text-[11px] text-white/70 mt-px">AI로 문제 자동 생성</div>
        </div>
      </Link>

      <div className="bg-white border border-[#EBE5DE] rounded-2xl px-[18px]">
        <div className="flex items-center justify-between py-[13px] border-b border-[#F2EDE7]">
          <span className="text-[12.5px] text-[#6B6460]">클래스</span>
          <span className="text-[15px] font-bold">{stats.totalClasses}</span>
        </div>
        <div className="flex items-center justify-between py-[13px] border-b border-[#F2EDE7]">
          <span className="text-[12.5px] text-[#6B6460]">학생</span>
          <span className="text-[15px] font-bold">{stats.totalStudents}</span>
        </div>
        <div className="flex items-center justify-between py-[13px]">
          <span className="text-[12.5px] text-[#6B6460]">만든 퀴즈</span>
          <span className="text-[15px] font-bold">{stats.totalQuizzes}</span>
        </div>
      </div>

      {recentQuizzes.length > 0 && (
        <div className="bg-white border border-[#EBE5DE] rounded-2xl p-[18px]">
          <div className="text-[13px] font-bold tracking-[-0.1px]">최근 만든 퀴즈</div>
          <div className="mt-3 flex flex-col gap-2.5">
            {recentQuizzes.map((q) => (
              <Link key={q.id} to={`/quiz/${q.id}`} className="flex items-center gap-2">
                <span className="text-[9.5px] font-bold text-primary bg-[#E8F1EB] rounded-[5px] px-1.5 py-[3px] shrink-0">
                  {q.difficulty}
                </span>
                <span className="text-[12.5px] font-semibold truncate">{q.title}</span>
              </Link>
            ))}
          </div>
          <Link to="/quizzes" className="block mt-3.5 text-xs font-semibold text-primary">
            내 퀴즈 {stats.totalQuizzes}개 전체 보기 →
          </Link>
        </div>
      )}

      {recentActiveClasses.length > 0 && (
        <div className="bg-white border border-[#EBE5DE] rounded-2xl p-[18px]">
          <div className="text-[13px] font-bold tracking-[-0.1px]">최근 활동 클래스</div>
          <div className="mt-2.5 flex flex-col">
            {recentActiveClasses.map((c) => (
              <Link key={c.id} to={`/class/${c.id}`} className="flex items-center gap-[9px] py-2.5 border-t border-[#F4F0EA]">
                <div className="w-6 h-6 rounded-full bg-[#E8F1EB] grid place-items-center text-[9.5px] font-bold text-primary shrink-0">
                  {initials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate">{c.name}</div>
                  <div className="text-[10.5px] text-[#8A837D] mt-px">{relativeTime(c.lastActivity)}</div>
                </div>
                <span className="text-[11.5px] font-bold text-primary">{c.avgScore}%</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between pt-3 border-t border-[#F2EDE7]">
            <Link to="/classes" className="text-xs font-semibold text-primary">
              내 클래스 {stats.totalClasses}개 →
            </Link>
            <Link
              to="/classes"
              state={{ openCreateDialog: true }}
              className="inline-flex items-center gap-1 border border-primary text-primary text-[11px] font-bold rounded-lg px-2.5 py-[5px]"
            >
              ＋ 새 클래스
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="bg-[#FAF8F5] px-[18px] sm:px-[30px] py-[26px] sm:py-8">
        <div className="flex items-baseline justify-between">
          <div className="text-[21px] font-bold tracking-[-0.4px]">안녕하세요, {displayName} 선생님</div>
          <div className="text-xs text-[#8A837D]">{todayLabel}</div>
        </div>

        {noQuizzesNoClasses ? (
          /* ── 2b: 퀴즈 0 · 클래스 0 (신규 가입) ── */
          <div className="mt-[18px] max-w-[940px] flex flex-col gap-3">
            <div className="bg-primary rounded-2xl sm:rounded-[18px] px-6 py-6 sm:px-[30px] sm:py-7 text-white">
              <div className="text-[19px] sm:text-[22px] font-bold tracking-[-0.4px]">첫 퀴즈를 만들어 보세요</div>
              <p className="text-[12.5px] sm:text-[13px] text-white/[.78] mt-1.5 leading-[1.55] sm:max-w-[560px]">
                가르칠 단어를 붙여넣으면 AI가 6가지 유형의 문제를 만듭니다. 클래스는 나중에 만들어도 됩니다.
              </p>
              <Textarea
                value={pasteWords}
                onChange={(e) => setPasteWords(e.target.value)}
                placeholder="학생, 선생님, 먹다, 마시다, 마음에 들다, 예쁘다&#10;또는 한 줄에 하나씩"
                className="mt-5 bg-white/[.13] border-white/[.26] text-white placeholder:text-white/[.55] text-[13px] leading-[1.7] rounded-[13px] min-h-[74px] resize-none"
              />
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11.5px] text-white/60">쉼표(,) 또는 줄바꿈으로 구분</span>
                <Button
                  onClick={handleCreateFromPaste}
                  className="bg-white text-primary hover:bg-white/90 rounded-xl h-auto py-[13px] px-[26px] text-[13.5px] font-bold"
                >
                  AI로 퀴즈 만들기
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Link to="/quiz/example" className="bg-white border border-[#EBE5DE] rounded-2xl p-5 block hover:border-primary/40 transition-colors">
                <div className="text-sm font-bold tracking-[-0.2px]">먼저 체험해 보기</div>
                <p className="text-[12.5px] text-[#6B6460] mt-1.5 leading-[1.6]">
                  단어를 넣기 전에 샘플 퀴즈로 6가지 유형이 어떤 문제인지 확인할 수 있습니다.
                </p>
                <span className="block text-center mt-4 border border-primary text-primary text-[12.5px] font-bold rounded-[11px] py-[11px]">
                  샘플 퀴즈 보기 →
                </span>
              </Link>
              <Link
                to="/classes"
                state={{ openCreateDialog: true }}
                className="bg-white border border-[#EBE5DE] rounded-2xl p-5 block hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-[17px] h-[17px] text-primary" strokeWidth={1.9} />
                  <div className="text-sm font-bold tracking-[-0.2px]">클래스 만들기</div>
                </div>
                <p className="text-[12.5px] text-[#6B6460] mt-1.5 leading-[1.6]">
                  클래스를 만들면 초대 코드가 생성되고, 학생이 가입하면 퀴즈를 배정할 수 있습니다.
                </p>
                <span className="block text-center mt-4 border border-primary text-primary text-[12.5px] font-bold rounded-[11px] py-[11px]">
                  ＋ 새 클래스
                </span>
              </Link>
            </div>
          </div>
        ) : (
          /* ── 2a(확인할 결과 있음) · 2c(모두 확인함) ── */
          <div className="mt-[18px] grid lg:grid-cols-[1fr_296px] gap-5 items-start">
            <div className="flex flex-col gap-3">
              {allCaughtUp ? (
                <div className="bg-primary rounded-2xl sm:rounded-[18px] px-[26px] sm:px-7 py-[26px] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div>
                    <div className="text-[11.5px] font-semibold tracking-[0.06em] text-white/[.62]">확인할 결과</div>
                    <div className="text-[21px] font-bold tracking-[-0.4px] mt-1.5">모두 확인했습니다</div>
                    <p className="text-[13px] text-white/[.78] mt-1.5 leading-[1.55] sm:max-w-[440px]">
                      제출된 결과를 전부 봤습니다. 다음 수업에 쓸 퀴즈를 미리 만들어 두세요.
                    </p>
                  </div>
                  <Link
                    to="/quiz/create"
                    className="shrink-0 bg-white text-primary text-[13.5px] font-bold rounded-xl px-6 py-[13px] whitespace-nowrap text-center"
                  >
                    새 퀴즈 만들기
                  </Link>
                </div>
              ) : (
                <div className="bg-primary rounded-2xl sm:rounded-[18px] px-6 py-6 sm:px-7 sm:py-[26px] text-white">
                  <div className="text-[11.5px] font-semibold tracking-[0.06em] text-white/[.62]">확인할 결과</div>
                  <div className="flex items-baseline justify-between gap-4 mt-1.5">
                    <div className="text-[22px] font-bold tracking-[-0.4px]">제출된 퀴즈 {unviewedCount}건</div>
                    <Link to="/quizzes" className="text-[12.5px] font-semibold text-white/[.82] whitespace-nowrap">
                      전체 보기 →
                    </Link>
                  </div>
                  <div className="mt-[18px] flex flex-col gap-2">
                    {heroResults.map((r) => (
                      <Link
                        key={r.id}
                        to={`/quiz/${r.quizId}/result/${r.id}`}
                        className="flex items-center gap-3.5 bg-white/[.11] rounded-xl px-4 py-[13px]"
                      >
                        <div className="w-[30px] h-[30px] rounded-full bg-white/[.22] grid place-items-center text-[11.5px] font-bold shrink-0">
                          {initials(r.studentName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-semibold truncate">{r.quizTitle}</div>
                          <div className="text-[11.5px] text-white/[.62] mt-0.5">
                            {r.studentName} · {relativeTime(r.completedAt)} 제출
                          </div>
                        </div>
                        <div className="text-[15px] font-bold shrink-0">
                          {r.score}/{r.total}
                        </div>
                        <span className="shrink-0 bg-white text-primary text-xs font-bold rounded-[9px] px-[15px] py-2">
                          결과 보기
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {pendingCard}

              {allCaughtUp && recentResults.length > 0 && (
                <div className="bg-white border border-[#EBE5DE] rounded-2xl p-5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-[14.5px] font-bold tracking-[-0.2px]">최근 결과</div>
                    <Link to="/quizzes" className="text-xs font-semibold text-primary">
                      전체 결과 보기 →
                    </Link>
                  </div>
                  <div className="mt-3.5 flex flex-col">
                    {recentResults.map((r) => (
                      <Link
                        key={r.id}
                        to={`/quiz/${r.quizId}/result/${r.id}`}
                        className="flex items-center gap-3 py-3 border-t border-[#F2EDE7]"
                      >
                        <div className="w-[26px] h-[26px] rounded-full bg-[#E8F1EB] grid place-items-center text-[10.5px] font-bold text-primary shrink-0">
                          {initials(r.studentName)}
                        </div>
                        <div className="flex-1 min-w-0 text-[13px] font-semibold truncate">{r.quizTitle}</div>
                        <div className="text-xs text-[#8A837D] whitespace-nowrap">
                          {r.studentName} · {relativeTime(r.completedAt)}
                        </div>
                        <div className="text-[13.5px] font-bold" style={{ color: resultScoreColor(r.score, r.total) }}>
                          {r.score}/{r.total}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {rail}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
