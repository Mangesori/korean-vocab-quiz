
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Link2, Search, Send, Loader2, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Class } from "@/hooks/useQuizData";

interface ShareQuizDialogContentProps {
  classes: Class[];
  selectedClassId: string;
  onSelectClass: (id: string) => void;
  onSendQuiz: () => void;
  isSending: boolean;
  shareUrl: string;
  allowAnonymous: boolean;
  onSetAllowAnonymous: (allow: boolean) => void;
  onGenerateLink: () => void;
  isGeneratingLink: boolean;
  onCopyLink: () => void;
  /** 다이얼로그 헤더 부제("퀴즈명 · A1 · 15개 단어")용 — 없으면 부제 줄을 생략한다. */
  quizTitle?: string;
  quizDifficulty?: string;
  quizWordCount?: number;
}

export function ShareQuizDialogContent({
  classes,
  selectedClassId,
  onSelectClass,
  onSendQuiz,
  isSending,
  shareUrl,
  allowAnonymous,
  onSetAllowAnonymous,
  onGenerateLink,
  isGeneratingLink,
  onCopyLink,
  quizTitle,
  quizDifficulty,
  quizWordCount
}: ShareQuizDialogContentProps) {
  const [search, setSearch] = useState("");

  const filteredClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((cls) => cls.name.toLowerCase().includes(q));
  }, [classes, search]);

  const subtitleParts = [quizTitle, quizDifficulty, quizWordCount != null ? `${quizWordCount}개 단어` : undefined].filter(
    Boolean
  );

  return (
    <DialogContent className="max-w-[560px] max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-[19px] font-bold">퀴즈 보내기</DialogTitle>
        {subtitleParts.length > 0 ? (
          <DialogDescription className="text-[12.5px]" style={{ color: "#8A837D" }}>
            {subtitleParts.join(" · ")}
          </DialogDescription>
        ) : (
          <DialogDescription>클래스에 배정하거나 링크로 공유하세요</DialogDescription>
        )}
      </DialogHeader>

      <Tabs defaultValue="class" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="class">클래스에 배정</TabsTrigger>
          <TabsTrigger value="share">링크 공유</TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="space-y-3">
          {classes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">아직 생성된 클래스가 없습니다</p>
              <Link to="/classes">
                <Button variant="outline">클래스 만들기</Button>
              </Link>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2 rounded-[11px] px-[14px] py-[11px]"
                style={{ background: "#FAF8F5", border: "1px solid #E3DCD3" }}
              >
                <Search className="shrink-0" style={{ width: 15, height: 15, color: "#A29B94" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="클래스 또는 학생 이름으로 검색…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[#A29B94]"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold" style={{ color: "#8A837D" }}>
                  최근 배정한 클래스
                </span>
                <span className="text-[11.5px]" style={{ color: "#8A837D" }}>
                  {classes.length}개 중 {filteredClasses.length}개 표시
                </span>
              </div>

              <div className="rounded-[12px] max-h-[280px] overflow-y-auto" style={{ border: "1px solid #EFE9E2" }}>
                {filteredClasses.length === 0 ? (
                  <div className="px-[14px] py-4 text-center text-sm text-muted-foreground">
                    검색 결과가 없습니다
                  </div>
                ) : (
                  filteredClasses.map((cls) => {
                    const selected = cls.id === selectedClassId;
                    const memberLabel = cls.member_count === 1 ? "1:1" : `학생 ${cls.member_count}명`;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => onSelectClass(cls.id)}
                        className="flex w-full items-center gap-3 px-[14px] py-[12px] text-left"
                        style={{
                          background: selected ? "#F4F9F6" : "transparent",
                          borderBottom: selected ? "1px solid #E4EDE8" : "1px solid #EFE9E2"
                        }}
                      >
                        <span
                          className="flex shrink-0 items-center justify-center rounded-full"
                          style={{
                            width: 18,
                            height: 18,
                            border: selected ? "none" : "1.5px solid #D5CEC6",
                            background: selected ? "#1E6B47" : "transparent"
                          }}
                        >
                          {selected && <Check style={{ width: 12, height: 12, color: "#fff" }} strokeWidth={3} />}
                        </span>
                        <span
                          className="flex shrink-0 items-center justify-center rounded-full"
                          style={{ width: 26, height: 26, background: "#E8F1EB", color: "#1E6B47" }}
                        >
                          <Users style={{ width: 14, height: 14 }} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span
                            className="block truncate text-[13px]"
                            style={{ fontWeight: selected ? 700 : 500, color: "#1A1714" }}
                          >
                            {cls.name}
                          </span>
                          <span className="block truncate text-[11px]" style={{ color: "#8A837D" }}>
                            {memberLabel}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-[11px]"
                          style={{
                            letterSpacing: "0.04em",
                            color: selected ? "#1E6B47" : "#A29B94",
                            fontWeight: selected ? 700 : 400
                          }}
                        >
                          {cls.invite_code}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground">
                  {selectedClassId ? "1개 선택됨" : "0개 선택됨"}
                </span>
                <div className="flex gap-2">
                  <Button className="w-full" onClick={onSendQuiz} disabled={!selectedClassId || isSending}>
                    {isSending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    배정하기
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="share" className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous">익명 응시 허용</Label>
              <Switch
                id="anonymous"
                checked={allowAnonymous}
                onCheckedChange={onSetAllowAnonymous}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              비회원도 퀴즈를 풀 수 있습니다 (최대 3회까지 응시 가능)
            </p>
          </div>

          {!shareUrl ? (
            <Button
              className="w-full"
              onClick={onGenerateLink}
              disabled={isGeneratingLink}
            >
              {isGeneratingLink ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              링크 생성
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>공유 링크</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={onCopyLink}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                이 링크를 공유하면 누구나 퀴즈를 풀 수 있습니다 (최대 3회 응시 가능)
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
