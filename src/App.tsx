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
import QuizDetail from "./pages/QuizDetail";
import QuizTake from "./pages/QuizTake";
import QuizResult from "./pages/QuizResult";
import Quizzes from "./pages/Quizzes";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import QuizShare from "./pages/QuizShare";
import QuizShareResult from "./pages/QuizShareResult";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/quiz/create" element={<QuizCreate />} />
            <Route path="/quiz/preview" element={<QuizPreview />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quiz/:id" element={<QuizDetail />} />
            <Route path="/quiz/:id/take" element={<QuizTake />} />
            <Route path="/quiz/:id/result/:resultId" element={<QuizResult />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/class/:id" element={<ClassDetail />} />
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
