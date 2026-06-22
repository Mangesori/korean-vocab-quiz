import type { WordMagnetProblem } from "@/types/quiz";
import { Card, CardContent } from "@/components/ui/card";

interface WordMagnetPreviewProps {
  problems: WordMagnetProblem[];
  studentPreview: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordMagnetPreview({ problems, studentPreview }: WordMagnetPreviewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">워드 마그넷 (문장 조립)</h2>
        <p className="text-muted-foreground">
          빈칸 채우기 문장에서 자동 생성됩니다. 문장을 수정하면 타일도 자동으로 다시 나뉩니다.
        </p>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto">
        {problems.map((p, idx) => {
          const tiles = studentPreview ? shuffle(p.items) : p.items;
          return (
            <Card key={p.problem_id} className="sm:rounded-2xl">
              <CardContent className="p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">#{idx + 1}</span>
                  <span className="text-sm sm:text-base font-medium text-foreground break-keep">{p.translation}</span>
                </div>
                {!studentPreview && (
                  <p className="text-xs text-muted-foreground">정답: {p.base_text}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50/60 p-3">
                  {tiles.map((t, i) => (
                    <span
                      key={i}
                      className={`rounded-xl px-3 py-2 text-base shadow-sm border whitespace-nowrap ${
                        t.isParticle
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-white text-foreground border-slate-200"
                      }`}
                    >
                      {t.content}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
