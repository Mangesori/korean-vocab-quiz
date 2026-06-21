import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackDialog } from './FeedbackDialog';

interface FeedbackButtonProps {
  /** 어느 화면에서 보냈는지 기록 (footer / pricing 등) */
  context: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>['variant'];
  size?: React.ComponentProps<typeof Button>['size'];
  className?: string;
  hideIcon?: boolean;
}

/** 어디서든 띄울 수 있는 피드백 트리거 버튼 + 모달. */
export function FeedbackButton({
  context,
  label = '피드백 보내기',
  variant = 'ghost',
  size = 'sm',
  className,
  hideIcon = false,
}: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {!hideIcon && <MessageSquarePlus className="h-4 w-4" />}
        {label}
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} context={context} />
    </>
  );
}
