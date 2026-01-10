
import { Link } from "react-router-dom";
import { Copy, Link2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  onCopyLink
}: ShareQuizDialogContentProps) {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>퀴즈 보내기</DialogTitle>
        <DialogDescription>클래스에 할당하거나 링크로 공유하세요</DialogDescription>
      </DialogHeader>
      
      <Tabs defaultValue="class" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="class">클래스에 할당</TabsTrigger>
          <TabsTrigger value="share">링크 공유</TabsTrigger>
        </TabsList>
        
        <TabsContent value="class" className="space-y-4">
          {classes.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">아직 생성된 클래스가 없습니다</p>
              <Link to="/classes">
                <Button variant="outline">클래스 만들기</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>클래스 선택</Label>
                <Select value={selectedClassId} onValueChange={onSelectClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="클래스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={onSendQuiz} disabled={!selectedClassId || isSending}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                보내기
              </Button>
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
