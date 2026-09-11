import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  UserMinus,
  Clock,
  Users,
  Copy,
  ChevronDown,
  FileX,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { StudentHistoryDialog } from '@/components/class/StudentHistoryDialog';
import { formatDateShort } from '@/lib/formatDate';
import { useClassSrsSummary } from '@/hooks/useClassSrsOverview';
import { SRS_STAGE_LABELS } from '@/lib/korean/srsStageLabels';

const SRS_STAGES = [0, 1, 2, 3, 4, 5, 6] as const;

interface ClassData {
  id: string;
  name: string;
  invite_code: string;
}

interface Member {
  id: string;
  student_id: string;
  joined_at: string;
  profile?: {
    name: string;
  };
}

// "마지막 활동 N일 전" — 없으면 "아직 활동 없음".
function daysAgoLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '아직 활동 없음';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '아직 활동 없음';
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return '오늘 활동';
  return `${days}일 전`;
}

export default function ClassStudents() {
  const { id } = useParams<{ id: string }>();
  const { user, role, loading } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState<{ id: string; name: string } | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const canViewSrs = role === 'teacher' || role === 'admin';
  const { data: srsRows, isLoading: srsLoading } = useClassSrsSummary(id || '');

  const { data, isLoading } = useQuery({
    queryKey: ['classStudents', id],
    queryFn: async () => {
      // Fetch class name + invite code
      const { data: cls, error } = await supabase
        .from('classes')
        .select('id, name, invite_code')
        .eq('id', id)
        .single();

      if (error || !cls) {
        throw new Error('클래스를 찾을 수 없습니다');
      }

      // Fetch members with profiles
      const { data: membersData } = await supabase
        .from('class_members')
        .select(`
          id,
          student_id,
          joined_at
        `)
        .eq('class_id', id);

      let membersWithProfiles: Member[] = [];
      if (membersData) {
        const memberIds = membersData.map(m => m.student_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', memberIds);

        membersWithProfiles = membersData.map(m => ({
          ...m,
          profile: profiles?.find(p => p.user_id === m.student_id),
        }));
      }

      // 학생별 마지막 활동 — 이 클래스 소속 여부와 무관하게 그 학생의 전체 제출 이력 중 최댓값.
      // (ClassDetail.tsx와 동일한 계산 방식.)
      const lastActivityByStudent = new Map<string, string>();
      const memberIds = membersWithProfiles.map((m) => m.student_id);
      if (memberIds.length > 0) {
        const { data: activityRows } = await supabase
          .from('quiz_results')
          .select('student_id, completed_at')
          .in('student_id', memberIds)
          .not('completed_at', 'is', null);

        (activityRows ?? []).forEach((r) => {
          if (!r.student_id || !r.completed_at) return;
          const prev = lastActivityByStudent.get(r.student_id);
          if (!prev || r.completed_at > prev) {
            lastActivityByStudent.set(r.student_id, r.completed_at);
          }
        });
      }

      return {
        classData: cls as ClassData,
        members: membersWithProfiles,
        lastActivityByStudent,
      };
    },
    enabled: !!user && !!id,
  });

  const classData = data?.classData ?? null;
  const members = data?.members ?? [];
  const lastActivityByStudent = data?.lastActivityByStudent ?? new Map<string, string>();

  // 학생별로 stage -> word_count를 모으고 due_now 합계를 낸다. 로스터(members)와
  // student_id로 join해 이름을 붙인다 — RPC는 이름을 모른다(wrong_answer_progress에 없음).
  const srsByStudent = useMemo(() => {
    const map = new Map<string, { name: string; stageCounts: Record<number, number>; dueNow: number }>();
    members.forEach((m) => {
      map.set(m.student_id, {
        name: m.profile?.name || '이름 없음',
        stageCounts: {},
        dueNow: 0,
      });
    });
    (srsRows || []).forEach((row) => {
      let entry = map.get(row.student_id);
      if (!entry) {
        // 로스터에는 없지만(탈퇴 등) RPC에는 남아있는 경우 대비.
        entry = { name: '이름 없음', stageCounts: {}, dueNow: 0 };
        map.set(row.student_id, entry);
      }
      entry.stageCounts[row.stage] = (entry.stageCounts[row.stage] || 0) + row.word_count;
      entry.dueNow += row.due_now_count;
    });
    return new Map(map.entries());
  }, [members, srsRows]);

  const copyInviteCode = () => {
    if (classData) {
      navigator.clipboard.writeText(classData.invite_code);
      toast.success('초대 코드가 복사되었습니다');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('정말 이 학생을 클래스에서 제외하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      queryClient.setQueryData(['classStudents', id], (prev: typeof data) => prev ? {
        ...prev,
        members: prev.members.filter(m => m.id !== memberId)
      } : prev);
      setExpandedStudentId(null);
      toast.success('학생이 제외되었습니다');
    } catch (error) {
      toast.error('제외에 실패했습니다');
    }
  };

  const goWrongAnswer = (studentId: string) => {
    navigate('/quiz/wrong-answer', { state: { classId: id, studentId } });
  };

  const goVocabPractice = (studentId: string) => {
    navigate('/quiz/vocab-practice', { state: { classId: id, studentId } });
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !can(PERMISSIONS.VIEW_CLASS)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!classData) return null;

  const gridCols = canViewSrs
    ? '1fr 130px 110px 90px 130px 130px'
    : '1fr 130px 130px 130px';

  return (
    <AppLayout>
      <div className="px-[18px] sm:px-[30px] py-[26px] sm:py-8">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-[21px] font-bold tracking-[-0.4px] text-[#1A1714] pl-2">
              학생 <span className="text-[#8A837D] font-semibold">{members.length}</span>명
            </h1>
            <p className="mt-[5px] text-[12.5px] text-[#8A837D]">
              복습 대기는 오늘 풀 수 있는 오답 개수입니다.
            </p>
          </div>
          <button
            onClick={copyInviteCode}
            className="inline-flex items-center gap-2 bg-white border border-[#E3DCD3] rounded-[11px] px-[14px] py-[10px] hover:bg-muted/40 transition-colors"
          >
            <span className="text-[11.5px] text-[#8A837D]">초대 코드</span>
            <span className="text-[13px] font-bold text-primary tracking-[.06em]">
              {classData.invite_code}
            </span>
            <Copy className="w-[14px] h-[14px] text-[#8A837D]" />
          </button>
        </div>

        {/* 테이블 */}
        {members.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-[#EBE5DE] rounded-2xl">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>가입한 학생이 없습니다</p>
          </div>
        ) : (
          <div className="border border-[#EBE5DE] rounded-2xl overflow-hidden">
            {/* 헤더 행 */}
            <div
              className="grid gap-[14px] px-[22px] py-[13px] bg-[#FBF9F6] border-b border-[#EFE9E2] text-[11px] font-bold text-[#8A837D] tracking-[.03em]"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span>학생</span>
              <span>가입일</span>
              {canViewSrs && (
                <>
                  <span>복습대기</span>
                  <span>졸업</span>
                </>
              )}
              <span>마지막활동</span>
              <span />
            </div>

            {members.map((member) => {
              const srs = srsByStudent.get(member.student_id);
              const dueNow = srs?.dueNow ?? 0;
              const graduated = srs?.stageCounts[6] ?? 0;
              const lastActivity = lastActivityByStudent.get(member.student_id);
              const hasActivity = !!lastActivity;
              const name = member.profile?.name || '이름 없음';
              const isExpanded = expandedStudentId === member.student_id;

              return (
                <div key={member.id} className="border-b border-[#F4F0EA] last:border-b-0">
                  {/* 기본 행 */}
                  <button
                    type="button"
                    onClick={() => setExpandedStudentId(isExpanded ? null : member.student_id)}
                    className="w-full grid gap-[14px] px-[22px] py-[14px] items-center text-left hover:bg-muted/20 transition-colors"
                    style={{ gridTemplateColumns: gridCols }}
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <ChevronDown
                        className="w-4 h-4 shrink-0 transition-transform"
                        style={{
                          color: isExpanded ? '#7FA893' : '#C4BDB6',
                          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        }}
                      />
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: hasActivity ? '#E8F1EB' : '#F3F0EA',
                        }}
                      >
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: hasActivity ? '#1E6B47' : '#6B6460' }}
                        >
                          {name[0]?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                      <span
                        className={`text-[13.5px] truncate ${isExpanded ? 'font-bold' : 'font-semibold'} text-[#1A1714]`}
                      >
                        {name}
                      </span>
                    </div>

                    <span className="text-[12.5px] text-[#6B6460]">
                      {formatDateShort(member.joined_at)}
                    </span>

                    {canViewSrs && (
                      <>
                        <span
                          className="text-[13px] font-bold"
                          style={{ color: dueNow > 0 ? '#B4552D' : '#B9B2AB' }}
                        >
                          {srsLoading ? '…' : dueNow > 0 ? `${dueNow}개` : '—'}
                        </span>
                        <span className="text-[12.5px] text-[#6B6460]">
                          {srsLoading ? '…' : graduated > 0 ? `${graduated}개` : '—'}
                        </span>
                      </>
                    )}

                    <span
                      className="text-[12.5px]"
                      style={{ color: hasActivity ? '#6B6460' : '#A29B94' }}
                    >
                      {hasActivity ? `${daysAgoLabel(lastActivity)}` : '아직 활동 없음'}
                    </span>

                    <span className="justify-self-end">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentForHistory({ id: member.student_id, name });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setSelectedStudentForHistory({ id: member.student_id, name });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 border border-[#C8DED3] rounded-[8px] px-[11px] py-[6px] text-[11.5px] font-semibold text-primary whitespace-nowrap hover:bg-[#F4F9F6] transition-colors cursor-pointer"
                      >
                        <Clock className="w-[13px] h-[13px]" /> 활동 기록
                      </span>
                    </span>
                  </button>

                  {/* 펼친 행 */}
                  {isExpanded && (
                    <div
                      className="border-b border-[#E4EDE8]"
                      style={{ background: '#F4F9F6' }}
                    >
                      <div className="pt-3 pb-[18px]" style={{ paddingLeft: 60, paddingRight: 22 }}>
                        {canViewSrs ? (
                          <>
                            <div className="flex items-baseline gap-[10px] mb-2.5">
                              <span className="text-[11.5px] font-bold" style={{ color: '#5C7D6C' }}>
                                복습 단계
                              </span>
                              <span className="text-[11.5px]" style={{ color: '#7FA893' }}>
                                맞힐수록 다음 단계로 넘어가고, 90일차를 지나면 졸업합니다.
                              </span>
                            </div>
                            <div className="flex gap-[7px]">
                              {SRS_STAGES.map((stage) => {
                                const count = srs?.stageCounts[stage] ?? 0;
                                const isGraduate = stage === 6;
                                const hasValue = count > 0;
                                const style = isGraduate
                                  ? {
                                      border: '1px solid #C8DED3',
                                      background: '#E8F1EB',
                                    }
                                  : {
                                      border: `1px solid ${hasValue ? '#DCE9E2' : '#EFE9E2'}`,
                                    };
                                const labelColor = isGraduate
                                  ? '#1E6B47'
                                  : hasValue
                                    ? '#7FA893'
                                    : '#A29B94';
                                const valueColor = isGraduate
                                  ? '#1E6B47'
                                  : hasValue
                                    ? '#1A1714'
                                    : '#C4BDB6';
                                return (
                                  <div
                                    key={stage}
                                    className="flex-1 rounded-[10px] py-[11px] text-center"
                                    style={style}
                                  >
                                    <div
                                      className="text-[10.5px] font-semibold"
                                      style={{ color: labelColor, fontWeight: isGraduate ? 700 : 600 }}
                                    >
                                      {SRS_STAGE_LABELS[stage]}
                                    </div>
                                    <div
                                      className="mt-[3px] text-[15px] font-bold"
                                      style={{ color: valueColor }}
                                    >
                                      {count}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : null}

                        <div className="mt-3 flex items-center gap-[9px]">
                          <button
                            onClick={() => goWrongAnswer(member.student_id)}
                            className="inline-flex items-center gap-1.5 border border-[#C8DED3] rounded-[8px] px-[12px] py-[7px] text-[11.5px] font-bold text-primary hover:bg-white/60 transition-colors"
                          >
                            <FileX className="w-[13px] h-[13px]" /> 오답 복습 퀴즈 만들기
                          </button>
                          <button
                            onClick={() => goVocabPractice(member.student_id)}
                            className="inline-flex items-center gap-1.5 border border-[#E3DCD3] rounded-[8px] px-[12px] py-[7px] text-[11.5px] font-semibold text-[#4A443F] hover:bg-white/60 transition-colors"
                          >
                            <BookOpen className="w-[13px] h-[13px]" /> 어휘 보강 퀴즈 만들기
                          </button>
                          <span className="flex-1" />
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold hover:underline"
                            style={{ color: '#C1554A' }}
                          >
                            <UserMinus className="w-[13px] h-[13px]" /> 클래스에서 제외
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <StudentHistoryDialog
          isOpen={!!selectedStudentForHistory}
          onClose={() => setSelectedStudentForHistory(null)}
          studentId={selectedStudentForHistory?.id || ""}
          studentName={selectedStudentForHistory?.name || ""}
          classId={id || ""}
        />
      </div>
    </AppLayout>
  );
}
