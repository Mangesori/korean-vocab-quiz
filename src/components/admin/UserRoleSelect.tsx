import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserRoleSelectProps {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
  isSelf: boolean;
  disabled?: boolean;
  onChange: (userId: string, role: 'admin' | 'teacher' | 'student') => void;
  className?: string;
}

// 역할 변경 Select. 원래 AdminDashboard.tsx의 UserTable 내부에 데스크톱/모바일
// 두 벌로 중복돼 있던 마크업을 하나로 뽑았다. 본인 계정이면 변경 불가 안내로 대체한다
// (자기 자신 강등/승격 방지는 호출부 handleRoleChange에서도 한 번 더 막지만,
// UI 자체도 여기서 잠근다).
export function UserRoleSelect({ userId, role, isSelf, disabled, onChange, className }: UserRoleSelectProps) {
  if (isSelf) {
    return <span className="text-sm text-muted-foreground">변경 불가</span>;
  }
  return (
    <Select
      value={role}
      onValueChange={(value) => onChange(userId, value as 'admin' | 'teacher' | 'student')}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? 'w-[110px]'}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">관리자</SelectItem>
        <SelectItem value="teacher">선생님</SelectItem>
        <SelectItem value="student">학생</SelectItem>
      </SelectContent>
    </Select>
  );
}
