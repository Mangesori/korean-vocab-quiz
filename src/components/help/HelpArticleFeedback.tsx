import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

type Vote = "up" | "down";

function voteKey(articleId: string) {
  return `help_vote_${articleId}`;
}

function readVote(articleId: string): Vote | null {
  const stored = localStorage.getItem(voteKey(articleId));
  return stored === "up" || stored === "down" ? stored : null;
}

interface HelpArticleFeedbackProps {
  articleId: string;
  articleTitle: string;
}

/**
 * 문서 하단 "이 문서가 도움이 됐나요?" 위젯.
 *
 * 👍는 서버로 보내지 않고 localStorage에만 기록한다 — feedback 테이블의
 * message 컬럼이 NOT NULL이라 내용 없는 더미 문자열을 넣으면 관리자 피드백
 * 목록이 오염된다. 실제로 콘텐츠를 고치게 만드는 건 문장이 있는 👎 쪽이라
 * 그쪽만 FeedbackDialog(context="help_article")로 서버에 전송한다.
 */
export function HelpArticleFeedback({ articleId, articleTitle }: HelpArticleFeedbackProps) {
  // 지연 초기값으로 첫 렌더부터 재방문 상태를 반영 (버튼이 잠깐 보였다 사라지는 깜빡임 방지).
  const [vote, setVote] = useState<Vote | null>(() => readVote(articleId));
  const [dialogOpen, setDialogOpen] = useState(false);

  // 이전/다음 문서 링크로 articleId만 바뀌는 클라이언트 사이드 전환에 대응
  useEffect(() => {
    setVote(readVote(articleId));
    setDialogOpen(false);
  }, [articleId]);

  const handleUp = () => {
    localStorage.setItem(voteKey(articleId), "up");
    setVote("up");
  };

  const handleDown = () => {
    localStorage.setItem(voteKey(articleId), "down");
    setVote("down");
    setDialogOpen(true);
  };

  return (
    <div className="mb-8 rounded-xl border border-border bg-card px-4 py-3.5">
      {vote ? (
        <p className="text-sm font-bold text-foreground break-keep">
          의견 감사합니다! 더 나은 도움말로 보답할게요.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-foreground break-keep">이 문서가 도움이 됐나요?</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleUp}>
              <ThumbsUp className="h-3.5 w-3.5" />
              도움됐어요
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleDown}>
              <ThumbsDown className="h-3.5 w-3.5" />
              아쉬워요
            </Button>
          </div>
        </div>
      )}

      <FeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context="help_article"
        initialMessage={`[도움말: ${articleTitle}] `}
      />
    </div>
  );
}
