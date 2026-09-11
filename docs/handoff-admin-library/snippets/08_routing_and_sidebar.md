# 08 — 탭 분리 · 라우팅 · 사이드바 (1단계)

## 현재 상태

`AdminDashboard.tsx` 한 파일(1259줄)에 탭 4개가 들어 있다.

```tsx
// AdminDashboard.tsx
const [tab, setTab] = useState(searchParams.get('tab') ?? 'dashboard');

<Tabs value={tab}>
  <TabsContent value="dashboard">…</TabsContent>   // 802–940
  <TabsContent value="teachers">…</TabsContent>    // 943–1024
  <TabsContent value="report">…</TabsContent>      // 1027–1173
  <TabsContent value="feedback">…</TabsContent>    // 1176–1225
</Tabs>
```

사이드바는 이미 별개 항목으로 보여주고 있다:

```tsx
// AppSidebar.tsx:173
const adminItems: NavItem[] = [
  { path: "/admin", label: "관리자 대시보드", exactSearch: "" },
  { path: "/admin", label: "선생님 관리",     exactSearch: "?tab=teachers", badgeCount: pendingCount },
  { path: "/admin", label: "시스템 리포트",   exactSearch: "?tab=report" },
  { path: "/admin", label: "피드백",         exactSearch: "?tab=feedback" },
  { path: "/admin/sentence-bank", label: "문장 은행 관리" },
  …
];
```

즉 **사용자에게는 이미 5개 화면**인데 코드만 한 파일이다. `exactSearch`는 이 불일치를 메우기 위한 장치다.

## 무엇을 하는가

탭 → 실제 페이지. **이 단계에서 디자인은 건드리지 않는다.** JSX를 그대로 옮기고, 각 탭이 쓰던 state·쿼리만 해당 파일로 따라가게 한다.

### 1. 파일 분리

```
src/pages/admin/
  AdminDashboard.tsx    ← ?tab=dashboard 중 지표 카드/도넛만 (사용자 표는 아래로)
  AdminUsers.tsx        ← ?tab=dashboard의 전체 사용자 표 + UserTable + exportUsersCsv
  AdminTeachers.tsx     ← ?tab=teachers + TeacherDetailDialog
  AdminReport.tsx       ← ?tab=report
  AdminFeedback.tsx     ← ?tab=feedback
```

기존 `src/pages/AdminDashboard.tsx`는 삭제하고 `src/pages/admin/`으로 옮긴다. `AdminSentenceBank.tsx`도 같은 폴더로 옮기면 일관되지만, import 경로 변경이 번지므로 선택 사항.

공통으로 쓰이던 것은 뽑아낸다:

```
src/components/admin/
  AdminPageShell.tsx    제목 + 우측 요약 + 본문 (5개 페이지 공통 레이아웃)
  UserRoleSelect.tsx    역할 변경 Select + 확인 다이얼로그
  RoleBadge.tsx         학생/선생님/관리자 배지
  StatStrip.tsx         지표 스트립 (snippets/01)
```

`UserTable`은 현재 `AdminDashboard` 내부 함수(644줄)다. `AdminUsers.tsx`로 옮기면서 컴포넌트로 승격한다 — 내부 함수로 두면 부모 리렌더마다 트리가 새로 만들어진다.

### 2. 라우트

```tsx
// App.tsx
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminTeachers from '@/pages/admin/AdminTeachers';
import AdminReport from '@/pages/admin/AdminReport';
import AdminFeedback from '@/pages/admin/AdminFeedback';

const adminRoute = (path: string, element: ReactNode) => (
  <Route path={path} element={
    <ProtectedRoute permission={PERMISSIONS.MANAGE_USERS} redirectTo="/dashboard">
      {element}
    </ProtectedRoute>
  } />
);
```

```tsx
{adminRoute('/admin', <AdminDashboard />)}
{adminRoute('/admin/users', <AdminUsers />)}
{adminRoute('/admin/teachers', <AdminTeachers />)}
{adminRoute('/admin/report', <AdminReport />)}
{adminRoute('/admin/feedback', <AdminFeedback />)}
{adminRoute('/admin/sentence-bank', <AdminSentenceBank />)}
```

`ProtectedRoute`가 children을 받는 형태가 아니면 기존처럼 개별 작성한다. 권한은 5개 모두 `MANAGE_USERS` 그대로.

### 3. 기존 URL 리다이렉트

`?tab=` 링크가 북마크나 외부 문서에 남아 있을 수 있다. `/admin`에서 처리한다:

```tsx
// admin/AdminDashboard.tsx 최상단
const [params] = useSearchParams();
const tab = params.get('tab');

if (tab === 'teachers')  return <Navigate to="/admin/teachers" replace />;
if (tab === 'report')    return <Navigate to="/admin/report" replace />;
if (tab === 'feedback')  return <Navigate to="/admin/feedback" replace />;
if (tab === 'users')     return <Navigate to="/admin/users" replace />;
```

`QuizImport.tsx:182`의 `navigate("/admin/sentence-bank", { state: { words } })`는 경로가 그대로이므로 수정 불필요.

### 4. 사이드바

`exactSearch`를 제거하고 실제 경로를 쓴다.

```tsx
const adminItems: NavItem[] = [
  { path: "/admin",               icon: Shield,         label: "관리자 대시보드", exactPath: true },
  { path: "/admin/users",         icon: Users,          label: "사용자 관리" },
  { path: "/admin/teachers",      icon: GraduationCap,  label: "선생님 관리", badgeCount: pendingCount },
  { path: "/admin/sentence-bank", icon: Library,        label: "문장 은행 관리" },
  { path: "/admin/report",        icon: FileText,       label: "시스템 리포트" },
  { path: "/admin/feedback",      icon: MessageSquare,  label: "피드백", badgeCount: unreadFeedbackCount },
  ...(user?.email === SUPER_ADMIN_EMAIL
    ? [{ path: "/quiz/import", icon: ClipboardPaste, label: "붙여넣기로 퀴즈 만들기" }]
    : []),
];
```

바뀐 것:

- `exactSearch` 전부 제거 (`/admin`만 `exactPath: true` — 하위 경로에서 활성되지 않게)
- **`사용자 관리` 신규 항목**, 대시보드 바로 아래
- 순서 재배치: 대시보드 → 사용자 → 선생님 → 문장 은행 → 리포트 → 피드백
  (처리 빈도 높은 것 위로, 조회용 리포트는 아래로)
- 피드백에 `badgeCount` 추가 — 대시보드 큐와 같은 숫자를 쓴다

`NavItem`에서 `exactSearch`를 쓰는 곳이 관리자 항목뿐이면 타입에서도 제거한다.

### 5. 배지 카운트 공유

대시보드 큐와 사이드바 배지가 같은 값을 쓴다. 각각 쿼리하면 어긋난다.

```tsx
// src/hooks/useAdminQueue.ts
export function useAdminQueue() {
  return useQuery({
    queryKey: ['admin', 'queue'],
    queryFn: async () => {
      const [apps, feedback] = await Promise.all([
        supabase.from('admin_teacher_applications').select('id, name, email, applied_at, created_at, submission_count'),
        supabase.from('feedback').select('id, created_at').eq('read', false).order('created_at'),
      ]);
      return {
        applications: apps.data ?? [],
        unreadFeedback: feedback.data ?? [],
      };
    },
    staleTime: 60_000,
  });
}
```

사이드바와 `/admin`이 같은 `queryKey`를 쓰므로 승인 처리 후 `invalidateQueries(['admin','queue'])` 한 번으로 둘 다 갱신된다.

## 확인

```
npm run build
```

- `/admin?tab=teachers` → `/admin/teachers`로 리다이렉트
- 사이드바 6개 항목이 각각 정확히 하나만 활성
- `/admin/users`에서 새로고침해도 목록 유지 (state 의존 없음)
- 선생님 승인 후 사이드바 배지와 대시보드 큐가 동시에 줄어듦

## 이 단계를 건너뛰면

5a에서 "표를 사용자 관리로 옮긴다"를 할 수 없다. 탭 안에 남겨두면 사이드바 "관리자 대시보드"를 눌렀을 때 표가 다시 보인다 — 개편의 요지가 사라진다.
