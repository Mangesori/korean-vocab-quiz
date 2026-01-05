import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelBadge } from "@/components/ui/level-badge";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Bell, ChevronRight, BookOpen, Clock } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Class {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

interface Quiz {
  id: string;
  title: string;
  words: string[];
  words_per_set: number;
  difficulty: string;
  created_at: string;
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
  const [classes, setClasses] = useState<Class[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalQuizzes: 0,
    pendingResults: 0,
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    // Fetch classes
    const { data: classesData } = await supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (classesData) setClasses(classesData);

    // Fetch quizzes
    const { data: quizzesData } = await supabase
      .from("quizzes")
      .select("*")
      .eq("teacher_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (quizzesData) setQuizzes(quizzesData);

    // Fetch notifications
    const { data: notificationsData } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user?.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(5);

    if (notificationsData) setNotifications(notificationsData);

    // Fetch stats
    const { count: classCount } = await supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("teacher_id", user?.id);

    const { count: quizCount } = await supabase
      .from("quizzes")
      .select("*", { count: "exact", head: true })
      .eq("teacher_id", user?.id);

    // Count total students across all classes
    const { data: classIds } = await supabase.from("classes").select("id").eq("teacher_id", user?.id);

    let studentCount = 0;
    if (classIds && classIds.length > 0) {
      const { count } = await supabase
        .from("class_members")
        .select("*", { count: "exact", head: true })
        .in(
          "class_id",
          classIds.map((c) => c.id),
        );
      studentCount = count || 0;
    }

    setStats({
      totalClasses: classCount || 0,
      totalStudents: studentCount,
      totalQuizzes: quizCount || 0,
      pendingResults: notifications.length,
    });
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">선생님 대시보드</h1>
          <p className="text-muted-foreground mt-1">수업과 퀴즈를 관리하세요</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 클래스</p>
                  <p className="text-2xl font-bold">{stats.totalClasses}</p>
                </div>
                <Users className="w-8 h-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">전체 학생</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
                <Users className="w-8 h-8 text-accent/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-success/10 to-success/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">생성된 퀴즈</p>
                  <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                </div>
                <FileText className="w-8 h-8 text-success/60" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-warning/10 to-warning/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">새 알림</p>
                  <p className="text-2xl font-bold">{stats.pendingResults}</p>
                </div>
                <Bell className="w-8 h-8 text-warning/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link to="/quiz/create">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-dashed border-2 border-primary/30 hover:border-primary">
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-semibold text-foreground">새 퀴즈 만들기</p>
                  <p className="text-sm text-muted-foreground">AI로 문제를 생성하세요</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/classes">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-dashed border-2 border-accent/30 hover:border-accent">
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <p className="font-semibold text-foreground">클래스 관리</p>
                  <p className="text-sm text-muted-foreground">학생을 초대하세요</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Items Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Quizzes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">최근 퀴즈</CardTitle>
                <CardDescription>생성한 퀴즈 목록</CardDescription>
              </div>
              <Link to="/quizzes">
                <Button variant="ghost" size="sm">
                  전체 보기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {quizzes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 생성된 퀴즈가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map((quiz) => (
                    <Link key={quiz.id} to={`/quiz/${quiz.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {quiz.words.length}개 단어 · {Math.ceil(quiz.words.length / quiz.words_per_set)}세트
                            </p>
                          </div>
                        </div>
                        <LevelBadge level={quiz.difficulty} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Classes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">내 클래스</CardTitle>
                <CardDescription>관리 중인 클래스</CardDescription>
              </div>
              <Link to="/classes">
                <Button variant="ghost" size="sm">
                  전체 보기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>아직 생성된 클래스가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classes.map((cls) => (
                    <Link key={cls.id} to={`/class/${cls.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{cls.name}</p>
                            <p className="text-xs text-muted-foreground">초대 코드: {cls.invite_code}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
