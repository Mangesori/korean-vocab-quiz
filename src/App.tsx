import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PERMISSIONS } from "@/lib/rbac/roles";

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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
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
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
