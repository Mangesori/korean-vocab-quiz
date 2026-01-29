import { useState } from 'react';
import { Navigate, Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/roles';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Plus,
  Megaphone,
  ArrowLeft,
  Pin,
  Trash2,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high';
  is_pinned: boolean;
  created_at: string;
  teacher_id: string;
}

interface ClassInfo {
  id: string;
  name: string;
  teacher_id: string;
}

export default function ClassAnnouncements() {
  const { id: classId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: 'normal' as const,
    is_pinned: false,
  });

  const { data: classInfo, isLoading: classLoading } = useQuery({
    queryKey: ['class', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, teacher_id')
        .eq('id', classId)
        .single();
      if (error) throw error;
      return data as ClassInfo;
    },
    enabled: !!classId,
  });

  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('class_id', classId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
    enabled: !!classId,
  });

  const isTeacher = classInfo?.teacher_id === user?.id || can(PERMISSIONS.MANAGE_USERS);

  const createMutation = useMutation({
    mutationFn: async (data: typeof newAnnouncement) => {
      // Create announcement
      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert({
          class_id: classId,
          teacher_id: user!.id,
          title: data.title,
          content: data.content,
          priority: data.priority,
          is_pinned: data.is_pinned,
        })
        .select()
        .single();

      if (error) throw error;

      // Get class members to send notifications
      const { data: members } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('class_id', classId);

      if (members && members.length > 0) {
        const notifications = members.map((m) => ({
          user_id: m.student_id,
          type: 'announcement' as const,
          title: '새 공지사항',
          message: `${classInfo?.name}: ${data.title}`,
          from_user_id: user!.id,
          announcement_id: announcement.id,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      return announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', classId] });
      setIsAddDialogOpen(false);
      setNewAnnouncement({ title: '', content: '', priority: 'normal', is_pinned: false });
      toast.success('공지사항이 등록되었습니다.');
    },
    onError: () => {
      toast.error('공지사항 등록에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', classId] });
      toast.success('공지사항이 삭제되었습니다.');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: !is_pinned })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', classId] });
    },
  });

  if (authLoading || classLoading || announcementsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return '중요';
      case 'low':
        return '참고';
      default:
        return '일반';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to={`/class/${classId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              클래스로 돌아가기
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Megaphone className="h-6 w-6" />
              공지사항
            </h1>
            <p className="text-muted-foreground mt-1">{classInfo?.name}</p>
          </div>

          {isTeacher && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  공지 작성
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>새 공지사항</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">제목 *</Label>
                    <Input
                      id="title"
                      value={newAnnouncement.title}
                      onChange={(e) =>
                        setNewAnnouncement({ ...newAnnouncement, title: e.target.value })
                      }
                      placeholder="공지 제목"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">내용 *</Label>
                    <Textarea
                      id="content"
                      value={newAnnouncement.content}
                      onChange={(e) =>
                        setNewAnnouncement({ ...newAnnouncement, content: e.target.value })
                      }
                      placeholder="공지 내용을 입력하세요"
                      rows={5}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2 flex-1">
                      <Label>중요도</Label>
                      <Select
                        value={newAnnouncement.priority}
                        onValueChange={(value: 'low' | 'normal' | 'high') =>
                          setNewAnnouncement({ ...newAnnouncement, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">참고</SelectItem>
                          <SelectItem value="normal">일반</SelectItem>
                          <SelectItem value="high">중요</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>상단 고정</Label>
                      <Button
                        type="button"
                        variant={newAnnouncement.is_pinned ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() =>
                          setNewAnnouncement({
                            ...newAnnouncement,
                            is_pinned: !newAnnouncement.is_pinned,
                          })
                        }
                      >
                        <Pin className="h-4 w-4 mr-2" />
                        {newAnnouncement.is_pinned ? '고정됨' : '고정'}
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => createMutation.mutate(newAnnouncement)}
                    disabled={
                      !newAnnouncement.title ||
                      !newAnnouncement.content ||
                      createMutation.isPending
                    }
                    className="w-full"
                  >
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    등록하기
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {announcements?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">아직 공지사항이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements?.map((announcement) => (
              <Card
                key={announcement.id}
                className={announcement.is_pinned ? 'border-primary' : ''}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                      <CardTitle className="text-lg">{announcement.title}</CardTitle>
                      <Badge variant={getPriorityColor(announcement.priority)}>
                        {getPriorityLabel(announcement.priority)}
                      </Badge>
                    </div>
                    {isTeacher && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            togglePinMutation.mutate({
                              id: announcement.id,
                              is_pinned: announcement.is_pinned,
                            })
                          }
                        >
                          <Pin
                            className={`h-4 w-4 ${
                              announcement.is_pinned ? 'text-primary' : ''
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(announcement.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <CardDescription>
                    {format(new Date(announcement.created_at), 'PPP', { locale: ko })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{announcement.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
