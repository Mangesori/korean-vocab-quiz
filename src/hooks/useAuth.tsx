import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'teacher' | 'student' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  /**
   * 역할 조회가 "끝났는지". role === null은 두 가지를 뜻할 수 있어서
   * (아직 조회 중 / 프로필이 없음) 구분이 필요하다.
   * 이 값이 false인 동안 role === null을 "프로필 없음"으로 해석하면
   * 대시보드 ↔ /auth/callback 무한 리다이렉트가 발생한다.
   */
  roleResolved: boolean;
  /** 프로필을 새로 만든 직후처럼 auth 이벤트 없이 역할이 바뀐 경우 다시 읽는다. */
  refreshRole: () => Promise<void>;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role?: 'teacher' | 'student') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [roleResolved, setRoleResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const fetchUserRole = async (userId: string) => {
    try {
      // maybeSingle: 프로필이 아직 없는 신규 가입자는 에러가 아니라 null이다.
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
        return null;
      }
      // 프로필이 없으면 undefined가 아니라 null로 통일한다(role === null 비교가 곳곳에 있다).
      return (data?.role ?? null) as UserRole;
    } catch (error) {
      console.error('Error fetching role:', error);
      return null;
    }
  };

  const refreshRole = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) {
      setRole(null);
      setRoleResolved(true);
      return;
    }
    const nextRole = await fetchUserRole(userId);
    setRole(nextRole);
    setRoleResolved(true);
  }, []);

  useEffect(() => {
    const applySession = (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      userIdRef.current = session?.user?.id ?? null;

      if (session?.user) {
        // 세션이 바뀌면 역할은 다시 "조회 중" 상태다.
        setRoleResolved(false);
        // supabase 콜백 안에서 곧바로 await하면 교착이 생길 수 있어 다음 틱으로 미룬다.
        setTimeout(() => { void refreshRole(); }, 0);
      } else {
        setRole(null);
        setRoleResolved(true);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // TOKEN_REFRESHED 이벤트는 창 포커스 시 발생하므로 무시
        // 실제 로그인/로그아웃 이벤트만 처리
        if (event === 'TOKEN_REFRESHED') {
          return;
        }
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, [refreshRole]);

  const signUp = async (email: string, password: string, name: string, userRole?: 'teacher' | 'student') => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            role: userRole,
          }
        }
      });

      if (authError) {
        return { error: authError };
      }

      // 프로필은 AuthCallback의 역할 선택 화면에서 생성한다.
      // (이메일/Google 가입 모두 동일한 선택 화면을 거치도록 통합)
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // 서버 에러(403 등)가 나도 로컬 세션 강제 정리
      await supabase.auth.signOut({ scope: 'local' });
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setRoleResolved(true);
    userIdRef.current = null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      roleResolved,
      refreshRole,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
