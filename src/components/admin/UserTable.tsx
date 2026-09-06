import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Trash2 } from 'lucide-react';
import { formatDateShort } from '@/lib/formatDate';
import { RoleBadge } from '@/components/admin/RoleBadge';
import { UserRoleSelect } from '@/components/admin/UserRoleSelect';
import type { AdminUser } from '@/components/admin/adminTypes';

interface UserTableProps {
  list: AdminUser[];
  emptyMsg: string;
  isLoading: boolean;
  currentUserId?: string;
  updatingUserId: string | null;
  onRoleChange: (userId: string, role: 'admin' | 'teacher' | 'student') => void;
  onDeleteRequest: (user: AdminUser) => void;
  showDetail?: boolean;
  onViewDetail?: (user: AdminUser) => void;
}

// 관리자 대시보드/사용자 관리/선생님 관리 3곳이 공유하는 사용자 표.
// 원래 AdminDashboard.tsx 안의 내부 함수(부모가 리렌더될 때마다 컴포넌트 트리가
// 새로 만들어지는 문제가 있었다)를 독립 컴포넌트로 승격했다. 마크업은 그대로다.
export function UserTable({
  list,
  emptyMsg,
  isLoading,
  currentUserId,
  updatingUserId,
  onRoleChange,
  onDeleteRequest,
  showDetail = false,
  onViewDetail,
}: UserTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }
  if (list.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">{emptyMsg}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-secondary/70 hover:bg-secondary/70">
              <TableHead className="h-10 w-[150px] text-[11px] font-extrabold tracking-wide text-muted-foreground">이름</TableHead>
              <TableHead className="h-10 w-[200px] text-[11px] font-extrabold tracking-wide text-muted-foreground">이메일</TableHead>
              <TableHead className="h-10 w-[120px] text-[11px] font-extrabold tracking-wide text-muted-foreground">현재 역할</TableHead>
              <TableHead className="h-10 w-[100px] text-[11px] font-extrabold tracking-wide text-muted-foreground">가입일</TableHead>
              <TableHead className="h-10 w-[130px] text-[11px] font-extrabold tracking-wide text-muted-foreground">역할 변경</TableHead>
              <TableHead className="h-10 w-[90px] text-right text-[11px] font-extrabold tracking-wide text-muted-foreground">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((u) => (
              <TableRow key={u.user_id} className="h-16 hover:bg-secondary/60">
                <TableCell className="py-0 font-medium truncate">
                  {u.profile?.name || '(이름 없음)'}
                  {u.user_id === currentUserId && (
                    <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                  )}
                </TableCell>
                <TableCell className="py-0 text-sm truncate">{u.email || '(이메일 없음)'}</TableCell>
                <TableCell className="py-0"><RoleBadge role={u.role} /></TableCell>
                <TableCell className="py-0 tabular-nums text-muted-foreground">
                  {formatDateShort(u.created_at)}
                </TableCell>
                <TableCell className="py-0">
                  <UserRoleSelect
                    userId={u.user_id}
                    role={u.role}
                    isSelf={u.user_id === currentUserId}
                    disabled={updatingUserId === u.user_id}
                    onChange={onRoleChange}
                  />
                </TableCell>
                <TableCell className="py-0 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {showDetail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => onViewDetail?.(u)}
                      >
                        자세히 보기
                      </Button>
                    )}
                    {u.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteRequest(u)}
                        aria-label="계정 삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile card stack */}
      <div className="md:hidden flex flex-col gap-3">
        {list.map((u) => (
          <div key={u.user_id} className="border border-border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {u.profile?.name || '(이름 없음)'}
                  {u.user_id === currentUserId && (
                    <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{u.email || '(이메일 없음)'}</p>
              </div>
              <RoleBadge role={u.role} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                가입일: {formatDateShort(u.created_at)}
              </span>
              {u.user_id === currentUserId ? (
                <span className="text-sm text-muted-foreground">변경 불가</span>
              ) : (
                <div className="flex items-center gap-2">
                  <UserRoleSelect
                    userId={u.user_id}
                    role={u.role}
                    isSelf={false}
                    disabled={updatingUserId === u.user_id}
                    onChange={onRoleChange}
                    className="w-28"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => onDeleteRequest(u)}
                    aria-label="계정 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {showDetail && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => onViewDetail?.(u)}
              >
                자세히 보기
              </Button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
