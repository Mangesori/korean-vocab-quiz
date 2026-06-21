import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/ui/level-badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Bell, ChevronRight, BookOpen, Clock, GraduationCap, FileX, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShareQuizDialogContent } from "@/components/quiz/ShareQuizDialog";
import { useQuizSharing } from "@/hooks/useQuizSharing";
import { QuizResultsDialog } from "@/components/quiz/QuizResultsDialog";
import { useClasses, Class as ClassModel } from "@/hooks/useClasses";
import { formatDateShort } from '@/lib/formatDate';

type Class = ClassModel;

interface Quiz {
  id: string;
  title: string;
  words: string[];
  words_per_set: number;
  difficulty: string;
  created_at: string;
  sentence_making_enabled?: boolean;
  recording_enabled?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { classes } = useClasses(user?.id);
  const [selectedQuizForResult, setSelectedResult] = useState<Quiz | null>(null);
  const [selectedQuizForShare, setSelectedQuizForShare] = useState<Quiz | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const {
    isSending,
    sendDialogOpen,
    setSendDialogOpen,
    reassignDialogOpen,
    handleConfirmReassign,
    handleCancelReassign,
    shareUrl,
    allowAnonymous,
    setAllowAnonymous,
    isGeneratingLink,
    handleSendQuiz,
    generateShareLink,
    copyToClipboard
  } = useQuizSharing(selectedQuizForShare as any, user, classes as any);

  const { data } = useQuery({
    queryKey: ['teacherDashboard', user?.id],
    queryFn: async () => {
      const { data: quizzesData } = await supabase
        .from("quizzes")
        .select("*")
        .eq("teacher_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(4);

      const { data: notificationsData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      const { count: quizCount } = await supabase
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", user?.id);

      const { data: classIds } = await supabase.from("classes").select("id").eq("teacher_id", user?.id);

      let studentCount = 0;
      if (classIds && classIds.length > 0) {
        const { count } = await supabase
          .from("class_members")
          .select("*", { count: "exact", head: true })
          .in("class_id", classIds.map((c) => c.id));
        studentCount = count || 0;
      }

      return {
        quizzes: (quizzesData || []) as Quiz[],
        notifications: (notificationsData || []) as Notification[],
        stats: {
          totalClasses: 0,
          totalStudents: studentCount,
          totalQuizzes: quizCount || 0,
          pendingResults: notificationsData?.length || 0,
        }
      };
    },
    enabled: !!user,
  });

  const quizzes = data?.quizzes ?? [];
  const notifications = data?.notifications ?? [];
  const stats = data?.stats ?? {
    totalClasses: 0,
    totalStudents: 0,
    totalQuizzes: 0,
    pendingResults: 0,
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            선생님 대시보드
          </h1>
          <p className="text-muted-foreground mt-1">수업과 퀴즈를 관리하세요</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-[18px]">
              <div className="font-ui text-xs text-muted-foreground mb-[6px]">전체 클래스</div>
              <div className="font-mono font-bold text-[26px] leading-none text-foreground">{classes.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-[18px]">
              <div className="font-ui text-xs text-muted-foreground mb-[6px]">전체 학생</div>
              <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-[18px]">
              <div className="font-ui text-xs text-muted-foreground mb-[6px]">생성된 퀴즈</div>
              <div className="font-mono font-bold text-[26px] leading-none text-foreground">{stats.totalQuizzes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-[18px]">
              <div className="font-ui text-xs text-muted-foreground mb-[6px]">새 알림</div>
              <div className="font-mono font-bold text-[26px] leading-none text-warning">{stats.pendingResults}</div>
              {stats.pendingResults > 0 && (
                <div className="font-ui text-xs text-warning mt-[5px]">미확인 결과</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-[10px] mb-[22px]">
          <Link to="/quiz/create" className="block">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-[10px] px-[14px] py-[10px]">
                <div className="w-[30px] h-[30px] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="w-[14px] h-[14px] text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">새 퀴즈 만들기</p>
                  <p className="text-xs text-muted-foreground">AI로 문제 자동 생성</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/quiz/wrong-answer" className="block">
            <Card className="hover:border-destructive transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-[10px] px-[14px] py-[10px]">
                <div className="w-[30px] h-[30px] rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <FileX className="w-[14px] h-[14px] text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">오답 복습 퀴즈</p>
                  <p className="text-xs text-muted-foreground">학생 오답으로 생성</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/classes" state={{ openCreateDialog: true }} className="block">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-[10px] px-[14px] py-[10px]">
                <div className="w-[30px] h-[30px] rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-[14px] h-[14px] text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">새 클래스 만들기</p>
                  <p className="text-xs text-muted-foreground">학생 초대 코드 발급</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Items Grid */}
        <div className="grid lg:grid-cols-2 gap-[18px]">
          {/* Recent Quizzes */}
          <Card className="overflow-hidden" style={{ padding: 0 }}>
            <CardHeader className="flex flex-row items-center justify-between px-[18px] py-[14px] border-b border-border">
              <div>
                <CardTitle className="text-md font-bold">내 퀴즈</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">생성한 퀴즈 목록</p>
              </div>
              <Link to="/quizzes">
                <Button variant="ghost" className="text-xs h-auto py-[3px] px-[9px] gap-[2px] [&_svg]:size-3">
                  전체 보기<ChevronRight />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {quizzes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 생성된 퀴즈가 없습니다</p>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-2 gap-2">
                  {quizzes.map((quiz) => (
                    <Link key={quiz.id} to={`/quiz/${quiz.id}`}>
                      <Card className="flex flex-col cursor-pointer hover:border-primary/40 transition-colors h-full">
                        <CardContent className="p-[14px] flex flex-col flex-1">
                          <div className="flex items-start justify-between mb-[10px]">
                            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4 text-primary" />
                            </div>
                            <LevelBadge level={quiz.difficulty} />
                          </div>
                          <h3 className="text-sm font-semibold truncate mb-0.5">{quiz.title}</h3>
                          <p className="text-xs text-muted-foreground mb-[10px]">
                            {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
                          </p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="font-ui text-xs text-muted-foreground flex items-center gap-[3px]">
                              <Clock className="w-3 h-3" />
                              {formatDateShort(quiz.created_at)}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-[7px]"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedQuizForShare(quiz as any);
                                  setSendDialogOpen(true);
                                  setSelectedClassId("");
                                }}
                              >
                                공유
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-xs px-[7px]"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedResult(quiz);
                                }}
                              >
                                결과
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Classes */}
          <Card className="overflow-hidden" style={{ padding: 0 }}>
            <CardHeader className="flex flex-row items-center justify-between px-[18px] py-[14px] border-b border-border">
              <div>
                <CardTitle className="text-md font-bold">내 클래스</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">관리 중인 클래스</p>
              </div>
              <Link to="/classes">
                <Button variant="ghost" className="text-xs h-auto py-[3px] px-[9px] gap-[2px] [&_svg]:size-3">
                  전체 보기<ChevronRight />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {classes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 생성된 클래스가 없습니다</p>
                </div>
              ) : (
                <div className="p-3 grid grid-cols-2 gap-2">
                  {classes.slice(0, 4).map((cls) => (
                    <Link key={cls.id} to={`/class/${cls.id}`}>
                      <Card className="flex flex-col cursor-pointer hover:border-primary/40 transition-colors h-full">
                        <CardContent className="p-[14px] flex flex-col flex-1">
                          <div className="flex items-center justify-between mb-[10px]">
                            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-primary" />
                            </div>
                            <button
                              className="flex items-center gap-1 mr-1 rounded px-1.5 py-1 hover:bg-accent transition-colors"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigator.clipboard.writeText(cls.invite_code);
                                toast.success('초대 코드가 복사되었습니다');
                              }}
                            >
                              <span className="font-mono font-bold text-xs text-primary">{cls.invite_code}</span>
                              <Copy className="w-3 h-3 text-primary" />
                            </button>
                          </div>
                          <h3 className="text-sm font-semibold truncate mb-0.5">{cls.name}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-[3px] mb-[10px]">
                            <Users className="w-3 h-3" />{cls.member_count}명
                          </p>
                          <div className="flex items-center justify-between mt-auto">
                            <span className="font-ui text-xs text-muted-foreground flex items-center gap-[3px]">
                              <Clock className="w-3 h-3" />
                              {formatDateShort(cls.created_at)}
                            </span>
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-[6px] gap-[2px] [&_svg]:size-3">
                              상세보기<ChevronRight />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <QuizResultsDialog
        quizId={selectedQuizForResult?.id || null}
        quizTitle={selectedQuizForResult?.title || ""}
        open={!!selectedQuizForResult}
        onOpenChange={(open) => !open && setSelectedResult(null)}
      />

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <ShareQuizDialogContent
          classes={classes as any}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          onSendQuiz={() => handleSendQuiz(selectedClassId, () => setSelectedClassId(""))}
          isSending={isSending}
          shareUrl={shareUrl}
          allowAnonymous={allowAnonymous}
          onSetAllowAnonymous={setAllowAnonymous}
          onGenerateLink={generateShareLink}
          isGeneratingLink={isGeneratingLink}
          onCopyLink={copyToClipboard}
        />
      </Dialog>

      <AlertDialog open={reassignDialogOpen} onOpenChange={(open) => { if (!open) handleCancelReassign(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이미 완료된 퀴즈입니다</AlertDialogTitle>
            <AlertDialogDescription>
              학생들이 이미 완료한 퀴즈입니다. 재할당하면 학생들이 다시 풀 수 있으며, 기존 풀이 기록은 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReassign}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReassign}>재할당</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
