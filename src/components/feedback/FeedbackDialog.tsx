import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 어느 화면에서 보냈는지 기록 (quiz_result / share_result / footer / pricing 등) */
  context: string;
  /** 별점 카드에서 별을 눌러 열었을 때 미리 채울 점수 */
  initialRating?: number | null;
  /** 특정 문맥(예: 도움말 문서 제목)을 미리 채워 넣고 싶을 때의 초기 메시지 */
  initialMessage?: string;
}

/**
 * 피드백 입력 모달 (controlled). 누구나(익명 게스트 포함) 제출 가능.
 * feedback 테이블 RLS가 INSERT를 anon에도 허용하고, 읽기는 관리자만.
 */
export function FeedbackDialog({
  open,
  onOpenChange,
  context,
  initialRating = null,
  initialMessage,
}: FeedbackDialogProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 모달이 열릴 때마다 별점 카드에서 넘어온 초기 점수를 반영
  useEffect(() => {
    if (open) setRating(initialRating ?? null);
  }, [open, initialRating]);

  // 모달이 열릴 때마다 넘어온 초기 메시지(예: 도움말 문서 제목 프리필)를 반영
  useEffect(() => {
    if (open && initialMessage) setMessage(initialMessage);
  }, [open, initialMessage]);

  const reset = () => {
    setMessage('');
    setEmail('');
    setRating(null);
    setHoverRating(null);
  };

  const handleSubmit = async () => {
    if (message.trim().length < 2) {
      toast.error('내용을 조금만 더 적어주세요');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        message: message.trim(),
        email: email.trim() || null,
        rating,
        context,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      toast.success('피드백 감사합니다!', {
        description: '소중한 의견은 서비스 개선에 바로 반영됩니다.',
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      console.error('Feedback submit error:', e);
      toast.error('전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>피드백 보내기</DialogTitle>
          <DialogDescription>
            좋았던 점, 불편했던 점, 바라는 기능 — 무엇이든 적어주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="feedback-message">내용</Label>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="예) 단어 목록만 넣으면 퀴즈가 바로 만들어져서 과제 내기 편해요. 다만…"
              className="min-h-[110px] resize-none"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>만족도 (선택)</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hoverRating ?? rating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-0.5"
                    aria-label={`${n}점`}
                  >
                    <Star className={`h-6 w-6 transition-colors ${active ? 'fill-warning text-warning' : 'text-muted-foreground/40'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-email">답변 받을 이메일 (선택)</Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || message.trim().length < 2}>
            {submitting ? '보내는 중...' : '보내기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
