import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import QuizCreate from "./pages/QuizCreate";
import QuizPreview from "./pages/QuizPreview";
import QuizExample from "./pages/QuizExample";
import QuizDetail from "./pages/QuizDetail";
import QuizTake from "./pages/QuizTake";
import QuizResult from "./pages/QuizResult";
import Quizzes from "./pages/Quizzes";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import ClassStudents from "./pages/ClassStudents";
import ClassAssignedQuizzes from "./pages/ClassAssignedQuizzes";
import QuizShare from "./pages/QuizShare";
import QuizShareResult from "./pages/QuizShareResult";
import QuizExampleResult from "./pages/QuizExampleResult";
import ProfileSettings from "./pages/ProfileSettings";
import VocabularyList from "./pages/VocabularyList";
import WrongAnswerNotebook from "./pages/WrongAnswerNotebook";
import WrongAnswerPractice from "./pages/WrongAnswerPractice";
import ClassAnnouncements from "./pages/ClassAnnouncements";
import WrongAnswerQuizCreate from "./pages/WrongAnswerQuizCreate";
import LiveSessionPreview from "./pages/LiveSessionPreview";
import LiveJoinPreview from "./pages/LiveJoinPreview";
import MyQuizzes from "./pages/MyQuizzes";
import HelpCenter from "./pages/HelpCenter";
import HelpArticle from "./pages/HelpArticle";

import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PERMISSIONS } from "@/lib/rbac/roles";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            {/* /pricing 파킹 중 (체험 기간). 복구 방법은 src/pages/Pricing.tsx 상단 주석 참조. */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={
              <ProtectedRoute permission={PERMISSIONS.MANAGE_USERS} redirectTo="/dashboard">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/quiz/example" element={<QuizExample />} />
            <Route path="/quiz/example/result" element={<QuizExampleResult />} />
            <Route path="/quiz/create" element={
              <ProtectedRoute permission={PERMISSIONS.CREATE_QUIZ} redirectTo="/dashboard">
                <QuizCreate />
              </ProtectedRoute>
            } />
            <Route path="/quiz/preview" element={
              <ProtectedRoute permission={PERMISSIONS.CREATE_QUIZ} redirectTo="/dashboard">
                <QuizPreview />
              </ProtectedRoute>
            } />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quiz/:id" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_QUIZ} redirectTo="/auth">
                <QuizDetail />
              </ProtectedRoute>
            } />
            <Route path="/quiz/:id/take" element={<QuizTake />} />
            <Route path="/quiz/:id/result/:resultId" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_QUIZ} redirectTo="/auth">
                <QuizResult />
              </ProtectedRoute>
            } />
            <Route path="/classes" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_CLASS} redirectTo="/auth">
                <Classes />
              </ProtectedRoute>
            } />
            <Route path="/class/:id" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_CLASS} redirectTo="/auth">
                <ClassDetail />
              </ProtectedRoute>
            } />
            <Route path="/class/:id/students" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_CLASS} redirectTo="/auth">
                <ClassStudents />
              </ProtectedRoute>
            } />
            <Route path="/class/:id/quizzes" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_CLASS} redirectTo="/auth">
                <ClassAssignedQuizzes />
              </ProtectedRoute>
            } />
            <Route path="/quiz/share/:token" element={<QuizShare />} />
            <Route path="/quiz/share/result" element={<QuizShareResult />} />

            {/* 새 기능 라우트 */}
            <Route path="/profile/settings" element={<ProfileSettings />} />
            <Route path="/vocabulary" element={<VocabularyList />} />
            <Route path="/wrong-answers" element={<WrongAnswerNotebook />} />
            <Route path="/wrong-answers/practice" element={<WrongAnswerPractice />} />
            <Route path="/class/:id/announcements" element={
              <ProtectedRoute permission={PERMISSIONS.VIEW_CLASS} redirectTo="/auth">
                <ClassAnnouncements />
              </ProtectedRoute>
            } />
            <Route path="/quiz/wrong-answer" element={
              <ProtectedRoute permission={PERMISSIONS.CREATE_QUIZ} redirectTo="/dashboard">
                <WrongAnswerQuizCreate />
              </ProtectedRoute>
            } />

            <Route path="/live/preview" element={<LiveSessionPreview />} />
            <Route path="/live/join-preview" element={<LiveJoinPreview />} />
            <Route path="/my-quizzes" element={<MyQuizzes />} />

            {/* 도움말은 비로그인 방문자도 봐야 하는 공개 페이지라 ProtectedRoute로 감싸지 않는다. */}
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/help/:articleId" element={<HelpArticle />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
