import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Mic,
  Square,
  PlayCircle,
  RefreshCw,
  Volume2,
  Lightbulb,
  Send,
  Trophy,
  FileText,
  Pencil,
  Home,
  Play,
} from "lucide-react";

type Stage =
  | "fill_blank"
  | "fill_blank_result"
  | "sentence_making"
  | "sentence_making_result"
  | "recording"
  | "recording_result"
  | "final_result";

const STAGES: { key: Stage; label: string }[] = [
  { key: "fill_blank", label: "빈칸 채우기" },
  { key: "fill_blank_result", label: "빈칸 채우기 결과" },
  { key: "sentence_making", label: "문장 만들기" },
  { key: "sentence_making_result", label: "문장 만들기 결과" },
  { key: "recording", label: "말하기 연습" },
  { key: "recording_result", label: "말하기 연습 결과" },
  { key: "final_result", label: "최종 결과" },
];

export default function QuizUIPreview() {
  const [currentStage, setCurrentStage] = useState<Stage>("fill_blank");

  const stageIndex = STAGES.findIndex((s) => s.key === currentStage);
  const goNext = () => {
    if (stageIndex < STAGES.length - 1) setCurrentStage(STAGES[stageIndex + 1].key);
  };
  const goPrev = () => {
    if (stageIndex > 0) setCurrentStage(STAGES[stageIndex - 1].key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      {/* Stage Navigation */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-bold text-lg">UI 미리보기 (하드코딩)</h1>
            <Badge variant="outline">{STAGES[stageIndex].label}</Badge>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STAGES.map((s, i) => (
              <Button
                key={s.key}
                variant={currentStage === s.key ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentStage(s.key)}
                className="text-xs whitespace-nowrap"
              >
                {i + 1}. {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {currentStage === "fill_blank" && <FillBlankStage />}
        {currentStage === "fill_blank_result" && <FillBlankResultStage />}
        {currentStage === "sentence_making" && <SentenceMakingStage />}
        {currentStage === "sentence_making_result" && <SentenceMakingResultStage />}
        {currentStage === "recording" && <RecordingStage />}
        {currentStage === "recording_result" && <RecordingResultStage />}
        {currentStage === "final_result" && <FinalResultStage />}

        {/* Bottom Nav */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={goPrev} disabled={stageIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전 단계
          </Button>
          <Button onClick={goNext} disabled={stageIndex === STAGES.length - 1}>
            다음 단계 <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============================================ */
/* 1. 빈칸 채우기                                 */
/* ============================================ */
function FillBlankStage() {
  const [showTranslations, setShowTranslations] = useState<Record<number, boolean>>({});

  const toggleTranslation = (num: number) => {
    setShowTranslations(prev => ({ ...prev, [num]: !prev[num] }));
  };

  const problems = [
    { num: 1, before: "저는 ( _____ )", hint: "-(이)라서", after: " 돈이 많지 않아요.", translation: "I don't have much money because I am a _____." },
    { num: 2, before: "그 옷이 ( _____ )", hint: "-(으)면", after: " 바로 살 거예요.", translation: "If I _____ those clothes, I will buy them right away." },
    { num: 3, before: "저는 ( _____ ) ", hint: "(으)ㄴ", after: " 가방을 하나 사고 싶어요.", translation: "I want to buy a _____ bag." },
    { num: 4, before: "오늘은 공휴일이어서 박물관에 ( _____ ) ", hint: "(으)로", after: " 들어갈 수 있어요.", translation: "Today is a public holiday, so we can enter the museum for _____." },
    { num: 5, before: "친구에게 대학교 합격 소식을 ( _____ ) ", hint: "-기 전에", after: " 부모님께 먼저 말했어요.", translation: "Before _____ my friend about my university acceptance, I told my parents first." },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header area */}
      <div className="mb-6 flex justify-center">
        <span className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold">세트 1</span>
      </div>

      <Card className="shadow-sm border mb-6 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          {/* Word Bank */}
          <div className="p-6 border-b">
            <p className="text-xs text-muted-foreground mb-4 text-center font-medium">보기</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["마음에 들다", "알리다", "학생", "무료", "예쁘다"].map((w, i) => (
                <span key={i} className="px-4 py-2 rounded-full text-sm bg-white border shadow-sm font-medium text-slate-700">{w}</span>
              ))}
            </div>
          </div>

          {/* Problems */}
          <div className="divide-y relative">
            {problems.map((p) => (
              <div key={p.num} className="p-5 sm:p-6">
                {/* Mobile Layout: Stacked */}
                <div className="flex flex-col gap-3 sm:hidden">
                  <div className="flex gap-2">
                    <span className="text-primary font-bold text-base min-w-[20px]">{p.num}.</span>
                    <span className="text-base font-medium leading-relaxed text-slate-800">
                      {p.before} <span className="text-primary font-medium mx-1">{p.hint}</span> {p.after}
                    </span>
                  </div>
                  <div className="w-full space-y-3 mt-1">
                    <Input className="h-11 w-full text-center text-sm rounded-xl border-slate-200" placeholder="정답 입력" />
                    <div className="flex gap-2 w-full">
                      <Button variant="outline" className="flex-1 h-10 rounded-xl text-slate-600 font-medium hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA] transition-all" size="sm">
                        <Volume2 className="w-4 h-4 mr-2" /> 듣기
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => toggleTranslation(p.num)}
                        className={`flex-1 h-10 rounded-xl font-medium transition-all ${showTranslations[p.num] ? "bg-amber-50 text-amber-600 border-amber-200" : "text-slate-600 hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA]"}`} 
                        size="sm"
                      >
                        <Lightbulb className={`w-4 h-4 mr-2 ${showTranslations[p.num] ? "text-amber-500" : ""}`} /> 힌트
                      </Button>
                    </div>
                  </div>
                  {showTranslations[p.num] && p.translation && (
                    <div className="mt-3 px-4 py-3 bg-sky-50 rounded-xl text-sm border border-sky-100 text-slate-800">
                      {p.translation}
                    </div>
                  )}
                </div>

                {/* Desktop Layout: Inline */}
                <div className="hidden sm:block">
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-bold text-lg min-w-[24px]">{p.num}.</span>
                    <div className="flex-1 flex items-center flex-wrap gap-1 leading-loose">
                      <span className="text-lg font-medium text-slate-800 whitespace-nowrap">{p.before.replace("( _____ )", "").trim()}</span>
                      <Input
                        className="w-48 h-10 mx-2 text-center text-base inline-block rounded-xl border-slate-200"
                        placeholder=""
                      />
                      {p.hint && <span className="text-primary text-base font-medium whitespace-nowrap">{p.hint}</span>}
                      <span className="text-lg font-medium text-slate-800 whitespace-nowrap">{p.after.trim()}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl text-slate-600 font-medium hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA] transition-all">
                        <Volume2 className="w-4 h-4 mr-1.5" /> 듣기
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => toggleTranslation(p.num)}
                        className={`h-10 px-4 rounded-xl font-medium transition-all ${showTranslations[p.num] ? "bg-amber-50 text-amber-600 border-amber-200" : "text-slate-600 hover:bg-[#20B2AA] hover:text-white hover:border-[#20B2AA]"}`}
                      >
                        <Lightbulb className={`w-4 h-4 mr-1.5 ${showTranslations[p.num] ? "text-amber-500" : ""}`} /> 힌트
                      </Button>
                    </div>
                  </div>
                  {showTranslations[p.num] && p.translation && (
                    <div className="mt-4 ml-8 px-4 py-3 bg-sky-50 rounded-xl text-sm border border-sky-100 text-slate-800">
                      {p.translation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-6">
        <Button variant="outline" className="h-12 px-6 rounded-xl bg-white/50 backdrop-blur-sm border-slate-200 text-slate-600 font-semibold hover:bg-white hover:text-slate-800 shadow-sm">
          <ChevronLeft className="w-4 h-4 mr-2" /> 이전 단계
        </Button>
        <Button className="h-12 px-6 rounded-xl bg-[#A399F7] text-white font-semibold hover:bg-[#8F83F5] shadow-md transition-colors">
          다음 단계 <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

/* ============================================ */
/* 2. 빈칸 채우기 결과                              */
/* ============================================ */
function FillBlankResultStage() {
  const [showFillBlankTrans, setShowFillBlankTrans] = useState<Record<number, boolean>>({});
  const answers = [
    { num: 1, word: "먹다", correct: "먹고 싶어요", user: "먹고 싶어요", ok: true, before: "저는 지금 맛있는 비빔밥을", after: ".", translation: "I want to eat delicious bibimbap now." },
    { num: 2, word: "학교", correct: "학교에", user: "학교에", ok: true, before: "저는 매일 아침 9시에", after: "가요.", translation: "I go to school at 9am every morning." },
    { num: 3, word: "학생", correct: "학생이", user: "학생이", ok: true, before: "제 동생은 아직", after: "아니에요.", translation: "My younger sibling is not a student yet." },
    { num: 4, word: "예쁘다", correct: "예쁜", user: "예쁜다", ok: false, before: "공원에", after: "꽃이 아주 많아요.", translation: "There are many pretty flowers in the park." },
    { num: 5, word: "의자", correct: "의자가", user: "의자가", ok: true, before: "지금 우리 교실에", after: "없어요.", translation: "There are no chairs in our classroom right now." },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4">
        {answers.map((a) => (
          <Card key={a.num} className="overflow-hidden border bg-card rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${a.ok ? "bg-success" : "bg-destructive"}`}>{a.num}</span>
                  <Badge variant="outline" className="font-semibold text-base px-3 py-1">{a.word}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm"><Volume2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">듣기</span></Button>
                  <Button variant="outline" size="sm" onClick={() => setShowFillBlankTrans(prev => ({ ...prev, [a.num]: !prev[a.num] }))}>
                    <Lightbulb className={`w-4 h-4 sm:mr-2 ${showFillBlankTrans[a.num] ? "text-warning" : ""}`} />
                    <span className="hidden sm:inline">번역 보기</span>
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-bold leading-relaxed text-foreground">
                  {a.before} <span className={`font-bold mx-1 ${a.ok ? "text-success" : "text-destructive"}`}>{a.correct}</span> {a.after}
                </h3>

                {!a.ok && (
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md bg-muted text-muted-foreground">
                      내 답변
                    </span>
                    <span className="text-base font-bold text-muted-foreground leading-normal">
                      {a.user}
                    </span>
                  </div>
                )}
                {showFillBlankTrans[a.num] && (
                  <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">{a.translation}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4 mt-8">
        <Button className="w-full sm:w-auto min-w-[200px] h-12 text-lg shadow-lg hover:shadow-xl transition-all" size="lg">
          <ChevronRight className="w-4 h-4 mr-2" /> 문장 만들기로 이동
        </Button>
      </div>
    </div>
  );
}

/* ============================================ */
/* 3. 문장 만들기                                  */
/* ============================================ */
function SentenceMakingStage() {
  const [showHint, setShowHint] = useState(false);
  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">문장 만들기</CardTitle>
          <span className="text-sm text-muted-foreground">3 / 3</span>
        </div>
        <Progress value={100} className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 단어 표시 */}
        <div className="p-5 sm:p-8 bg-slate-50 border-none rounded-2xl flex flex-col min-h-[250px]">
          <div className="flex w-full items-center justify-end mb-8">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowHint(!showHint)}
              className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
            >
              <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${showHint ? "text-warning" : ""}`} />
              힌트
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mb-4 text-center">
              이 단어를 사용하여 문장을 만드세요
            </p>
            <Badge variant="outline" className="text-xl sm:text-2xl px-8 py-2.5 sm:py-3 font-bold bg-white shadow-sm border-slate-200 rounded-2xl text-slate-800">
              예쁘다
            </Badge>
            
            <p className={`text-sm sm:text-base text-muted-foreground mt-5 text-center transition-opacity duration-200 ${showHint ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              to be pretty
            </p>
          </div>
        </div>

        {/* 입력 */}
        <Textarea
          placeholder={'"예쁘다"을(를) 사용하여 문장을 작성하세요...'}
          className="min-h-[100px] text-lg"
          defaultValue="이 꽃이 정말 예뻐요"
        />

        {/* 이전/채점 버튼 */}
        <div className="flex justify-between">
          <Button variant="outline" className="h-12 text-base">
            <ChevronLeft className="w-4 h-4 mr-1" /> 이전
          </Button>
          <Button className="bg-success hover:bg-success/90 h-12 text-base">
            <Send className="w-4 h-4 mr-2" /> 채점하기
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================ */
/* 4. 문장 만들기 결과                              */
/* ============================================ */
function SentenceMakingResultStage() {
  const results = [
    { 
      word: "학교", 
      sentence: "학교 가요", 
      correctedSentence: (
        <>
          <span className="text-foreground">학교</span>
          <span className="text-destructive bg-destructive/10 px-0.5 rounded">에</span>
          <span className="text-foreground"> 가요</span>
        </>
      ),
      feedback: "단어를 적절하게 사용했지만, '학교에 가요'처럼 조사 '에'를 추가하면 더 자연스럽습니다." 
    },
    { 
      word: "먹다", 
      sentence: "밥을 먹어요", 
      correctedSentence: null,
      feedback: "완벽한 문장입니다! 단어 활용과 조사 사용이 정확합니다." 
    },
    { 
      word: "예쁘다", 
      sentence: "예빠요", 
      correctedSentence: (
        <>
          <span className="text-destructive bg-destructive/10 px-0.5 rounded">예뻐요</span>
        </>
      ),
      feedback: "'예쁘다'는 '-어요'와 결합할 때 'ㅡ'가 탈락하여 '예뻐요'가 됩니다." 
    },
  ];

  return (
    <div className="w-full space-y-4">
      {results.map((r, idx) => (
        <Card key={idx} className="overflow-hidden border bg-card rounded-xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${r.correctedSentence ? "bg-destructive" : "bg-success"}`}>{idx + 1}</span>
                <Badge variant="outline" className="font-semibold text-base px-3 py-1">{r.word}</Badge>
              </div>
            </div>
            
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className={`shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md ${r.correctedSentence ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                  내 답변
                </span>
                <h3 className={`text-lg font-bold leading-normal ${r.correctedSentence ? "text-muted-foreground" : "text-success"}`}>
                  {r.sentence}
                </h3>
              </div>
              
              {r.correctedSentence && (
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md bg-destructive/10 text-destructive">
                    추천 문장
                  </span>
                  <h3 className="text-lg font-bold text-destructive leading-normal">{r.correctedSentence}</h3>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{r.feedback}</p>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button className="w-full h-12 text-base" size="lg">
        <ChevronRight className="w-4 h-4 mr-2" /> 말하기 연습으로 이동
      </Button>
    </div>
  );
}

/* ============================================ */
/* 5. 말하기 연습                                  */
/* ============================================ */
function RecordingStage() {
  const [showHint, setShowHint] = useState(false);
  const problems = [
    {
      num: "1/3",
      type: "듣고 말하기",
      mode: "listen",
      sentence: "저는 매일 아침 9시에 학교에 가요.",
      translation: "I go to school at 9am every morning.",
      state: "recording", // 말하기 연습 진행 중 예시
    },
    {
      num: "2/3",
      type: "보고 말하기",
      mode: "read",
      sentence: "배고파요. 그런데 음식이 없어요.",
      translation: "I'm hungry. But there is no food.",
      state: "completed", // 말하기 연습 완료 예시
    }
  ];

  return (
    <div className="w-full space-y-8">
      {problems.map((p, idx) => (
        <Card key={idx} className="w-full">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">말하기 연습</CardTitle>
              <span className="text-sm text-muted-foreground">{p.num}</span>
            </div>
            <Progress value={idx === 0 ? 33 : 66} className="mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sentence Display */}
            <div className="p-5 sm:p-8 bg-slate-50 border-none rounded-2xl flex flex-col min-h-[250px]">
              <div className="flex w-full items-center justify-between mb-8">
                <div className="text-xs sm:text-sm font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-3 py-1.5 rounded-full inline-flex items-center">
                  {p.type}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                  className="bg-white text-xs h-8 px-3 rounded-xl shadow-sm text-slate-600"
                >
                  <Lightbulb className={`w-3.5 h-3.5 mr-1.5 ${showHint ? "text-warning" : ""}`} />
                  힌트
                </Button>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                {p.mode === "read" && (
                  <h3 className="text-xl font-bold mb-4 text-foreground leading-relaxed text-center">{p.sentence}</h3>
                )}
                
                {p.mode === "listen" && (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">음성을 듣고 따라 말하기 연습하세요</p>
                    <Button variant="outline" className="flex items-center justify-center rounded-xl px-6 h-11 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm">
                      <Volume2 className="w-4 h-4 mr-2" />
                      <span className="font-semibold">듣기</span>
                    </Button>
                  </div>
                )}

                <p className={`text-sm sm:text-base text-muted-foreground mt-5 text-center transition-opacity duration-200 ${showHint ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  {p.translation}
                </p>
              </div>
            </div>

            {p.state === "recording" ? (
              /* Record Button */
              <div className="flex flex-col items-center gap-4 py-8">
                <Button size="lg" className="rounded-full w-24 h-24 shadow-md bg-primary hover:bg-primary/90">
                  <Mic className="w-10 h-10 text-primary-foreground" />
                </Button>
                <p className="text-sm text-muted-foreground font-medium animate-pulse mt-2">마이크 버튼을 눌러 말하기 연습을 시작하세요</p>
              </div>
            ) : (
              /* Result (after recording) */
              <div className="space-y-6 mt-6">
                <div className="p-6 rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span className="font-bold text-success">평가 완료</span>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <button className="flex items-center justify-center bg-secondary text-secondary-foreground rounded-2xl py-4 px-4 w-full transition-opacity hover:opacity-90">
                      <Volume2 className="w-5 h-5 mr-4" />
                      <div className="flex gap-[3px] items-center h-5">
                        {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                          <div key={`read-${i}`} className="w-[3px] bg-secondary-foreground/40 rounded-full" style={{ height: `${h * 3}px` }} />
                        ))}
                      </div>
                    </button>
                  </div>

                  <p className="text-lg text-center py-2 font-medium text-success">
                    You said it perfectly.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" className="flex-1 h-12 text-base" size="lg">
                    <RefreshCw className="w-4 h-4 mr-2" /> 다시 시도하기
                  </Button>
                  <Button className="flex-1 h-12 text-base" size="lg">다음 문제</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ============================================ */
/* 6. 말하기 연습 결과                              */
/* ============================================ */
function RecordingResultStage() {
  const [showRecordingTrans, setShowRecordingTrans] = useState<Record<number, boolean>>({});
  const results = [
    { sentence: "저는 매일 아침 9시에 학교에 가요.", translation: "I go to school at 9am every morning.", passed: true, lowWords: ["학교에"] },
    { sentence: "이 음식이 정말 맛있어요.", translation: "This food is really delicious.", passed: true, lowWords: [] },
    { sentence: "공원에 예쁜 꽃이 아주 많아요.", translation: "There are many pretty flowers in the park.", passed: false, lowWords: ["예쁜"] },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4">
        {results.map((r, idx) => (
          <Card key={idx} className="overflow-hidden border bg-card rounded-xl shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${r.passed ? "bg-success" : "bg-destructive"}`}>{idx + 1}</span>
                  <div className="text-sm font-semibold text-primary/80 bg-primary/10 px-3 py-1 rounded-full">보고 말하기</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRecordingTrans(prev => ({ ...prev, [idx]: !prev[idx] }))}>
                  <Lightbulb className={`w-4 h-4 sm:mr-2 ${showRecordingTrans[idx] ? "text-warning" : ""}`} />
                  <span className="hidden sm:inline">번역 보기</span>
                </Button>
              </div>
              
              <h3 className="text-lg font-bold mb-4 text-foreground leading-relaxed pl-3">{r.sentence}</h3>
              {showRecordingTrans[idx] && (
                <p className="text-sm text-muted-foreground mb-6 bg-slate-50 p-3 rounded-lg">{r.translation}</p>
              )}
              
              <div className="space-y-3 mb-4 mt-6">
                <button className="flex items-center justify-center bg-secondary text-secondary-foreground rounded-2xl py-4 px-4 w-full transition-opacity hover:opacity-90">
                  <Volume2 className="w-5 h-5 mr-4" />
                  <div className="flex gap-[3px] items-center h-5">
                    {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                      <div key={`read-${i}`} className="w-[3px] bg-secondary-foreground/40 rounded-full" style={{ height: `${h * 3}px` }} />
                    ))}
                  </div>
                </button>
              </div>

              {r.lowWords.length > 0 ? (
                <p className="text-base mt-6 text-muted-foreground pl-3">
                  {r.sentence.split(/(\s+)/).map((word, i) => {
                    const clean = word.replace(/[.,!?]/g, "");
                    const isLow = r.lowWords.includes(clean);
                    return isLow ? (
                      <span key={i} className="text-muted-foreground">{word}</span>
                    ) : (
                      word.trim() === "" ? <span key={i}>{word}</span> : <span key={i} className="text-success font-medium">{word}</span>
                    );
                  })}
                </p>
              ) : (
                <p className="text-base mt-6 font-medium text-success pl-3">
                  You said it perfectly.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4 mt-8">
        <Button className="w-full sm:w-auto min-w-[200px] h-12 text-lg shadow-lg hover:shadow-xl transition-all" size="lg">
          <Trophy className="w-4 h-4 mr-2" /> 완료
        </Button>
      </div>
    </div>
  );
}

/* ============================================ */
/* 7. 최종 결과                                   */
/* ============================================ */
function FinalResultStage() {
  const [showFillBlankTrans, setShowFillBlankTrans] = useState<Record<number, boolean>>({});
  const [showRecordingTrans, setShowRecordingTrans] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-8">
      {/* Result Header - 실제 QuizResult.tsx와 동일 */}
      <div className="text-center animate-fade-in">
        <h1 className="text-2xl font-bold mb-4">한국어 A1 테스트</h1>
        <div className="relative inline-flex items-center justify-center">
          <div className="text-6xl font-black bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent">
            73%
          </div>
        </div>
        <p className="mt-4 text-muted-foreground font-medium">11문제 중 8문제를 맞혔어요!</p>
        <p className="mt-2 text-lg font-bold">좋아요! 조금만 더 힘내볼까요? 💪</p>
      </div>

      {/* 탭 기반 상세 리뷰 - 점수 통합 컴팩트 디자인 */}
      <Tabs defaultValue="fill_blank" className="w-full mt-4">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-auto p-1.5 bg-slate-100/60 rounded-2xl gap-1">
          <TabsTrigger value="fill_blank" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
            <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
              <FileText className="w-4 h-4" />
              <span className="text-sm">빈칸 채우기</span>
            </div>
            <span className="text-xl font-bold text-blue-500">60%</span>
          </TabsTrigger>
          <TabsTrigger value="sentence_making" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
            <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
              <Pencil className="w-4 h-4" />
              <span className="text-sm">문장 만들기</span>
            </div>
            <span className="text-xl font-bold text-green-500">67%</span>
          </TabsTrigger>
          <TabsTrigger value="recording" className="flex flex-col items-center py-3 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all focus:outline-none">
            <div className="flex items-center gap-1.5 mb-1.5 font-medium text-muted-foreground data-[state=active]:text-foreground">
              <Mic className="w-4 h-4" />
              <span className="text-sm">말하기 연습</span>
            </div>
            <span className="text-xl font-bold text-purple-500">67%</span>
          </TabsTrigger>
        </TabsList>

        {/* 빈칸 채우기 리뷰 */}
        <TabsContent value="fill_blank">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <span className="text-lg font-bold">세트 1</span>
                <div className="h-px bg-border flex-1" />
              </div>
              <div className="grid gap-4">
                {[
                  { num: 1, word: "먹다", correct: "먹고 싶어요", user: "먹고 싶어요", ok: true, before: "저는 지금 맛있는 비빔밥을", after: ".", translation: "I want to eat delicious bibimbap now." },
                  { num: 2, word: "학교", correct: "학교에", user: "학교에", ok: true, before: "저는 매일 아침 9시에", after: "가요.", translation: "I go to school at 9am every morning." },
                  { num: 3, word: "학생", correct: "학생이", user: "학생이", ok: true, before: "제 동생은 아직", after: "아니에요.", translation: "My younger sibling is not a student yet." },
                  { num: 4, word: "예쁘다", correct: "예쁜", user: "예쁜다", ok: false, before: "공원에", after: "꽃이 아주 많아요.", translation: "There are many pretty flowers in the park." },
                  { num: 5, word: "의자", correct: "의자가", user: "의자가", ok: true, before: "지금 우리 교실에", after: "없어요.", translation: "There are no chairs in our classroom right now." },
                ].map((a) => (
                  <Card key={a.num} className="overflow-hidden border bg-card rounded-xl shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${a.ok ? "bg-success" : "bg-destructive"}`}>{a.num}</span>
                          <Badge variant="outline" className="font-semibold text-base px-3 py-1">{a.word}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm"><Volume2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">듣기</span></Button>
                          <Button variant="outline" size="sm" onClick={() => setShowFillBlankTrans(prev => ({ ...prev, [a.num]: !prev[a.num] }))}>
                            <Lightbulb className={`w-4 h-4 sm:mr-2 ${showFillBlankTrans[a.num] ? "text-warning" : ""}`} />
                            <span className="hidden sm:inline">번역 보기</span>
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold leading-relaxed text-foreground">
                          {a.before} <span className={`font-bold mx-1 ${a.ok ? "text-success" : "text-destructive"}`}>{a.correct}</span> {a.after}
                        </h3>

                        {!a.ok && (
                          <div className="flex items-center gap-3">
                            <span className="shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md bg-muted text-muted-foreground">
                              내 답변
                            </span>
                            <span className="text-base font-bold text-muted-foreground leading-normal">
                              {a.user}
                            </span>
                          </div>
                        )}
                        {showFillBlankTrans[a.num] && (
                          <p className="text-sm text-muted-foreground bg-slate-50 p-3 rounded-lg">{a.translation}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 문장 만들기 리뷰 */}
        <TabsContent value="sentence_making">
          <div className="space-y-4">
            {[
              { word: "학교", sentence: "학교 가요", passed: true, feedback: "조사 '에'를 추가하면 더 자연스럽습니다.", correctedSentence: (
                  <>
                    <span className="text-foreground">학교</span>
                    <span className="text-destructive bg-destructive/10 px-0.5 rounded">에</span>
                    <span className="text-foreground"> 가요</span>
                  </>
                ) },
              { word: "먹다", sentence: "밥을 먹어요", passed: true, feedback: "완벽한 문장입니다!", correctedSentence: null },
              { word: "예쁘다", sentence: "예빠요", passed: false, feedback: "'예쁘다'의 올바른 활용은 '예뻐요'입니다.", correctedSentence: (
                  <>
                    <span className="text-destructive bg-destructive/10 px-0.5 rounded">이 꽃이 정말 예뻐요.</span>
                  </>
                ) },
            ].map((r, idx) => (
              <Card key={idx} className="overflow-hidden border bg-card rounded-xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${r.correctedSentence ? "bg-destructive" : "bg-success"}`}>{idx + 1}</span>
                      <Badge variant="outline" className="font-semibold text-base px-3 py-1">{r.word}</Badge>
                    </div>
                  </div>
                  
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md ${r.correctedSentence ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                        내 답변
                      </span>
                      <h3 className={`text-lg font-bold leading-normal ${r.correctedSentence ? "text-muted-foreground" : "text-success"}`}>
                        {r.sentence}
                      </h3>
                    </div>
                    
                    {r.correctedSentence && (
                      <div className="flex items-center gap-3">
                        <span className="shrink-0 text-xs font-bold py-1 w-14 text-center rounded-md bg-destructive/10 text-destructive">
                          추천 문장
                        </span>
                        <h3 className="text-lg font-bold text-destructive leading-normal">{r.correctedSentence}</h3>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.feedback}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 녹음 리뷰 */}
        <TabsContent value="recording">
          <div className="space-y-4">
            {[
              { sentence: "저는 매일 아침 9시에 학교에 가요.", translation: "I go to school at 9am every morning.", passed: true, lowWords: ["학교에"] },
              { sentence: "이 음식이 정말 맛있어요.", translation: "This food is really delicious.", passed: true, lowWords: [] },
              { sentence: "공원에 예쁜 꽃이 아주 많아요.", translation: "There are many pretty flowers in the park.", passed: false, lowWords: ["예쁜"] },
            ].map((r, idx) => (
              <Card key={idx} className="overflow-hidden border bg-card rounded-xl shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${r.passed ? "bg-success" : "bg-destructive"}`}>{idx + 1}</span>
                      <div className="text-sm font-semibold text-primary/80 bg-primary/10 px-3 py-1 rounded-full">보고 말하기</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowRecordingTrans(prev => ({ ...prev, [idx]: !prev[idx] }))}>
                      <Lightbulb className={`w-4 h-4 sm:mr-2 ${showRecordingTrans[idx] ? "text-warning" : ""}`} />
                      <span className="hidden sm:inline">번역 보기</span>
                    </Button>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-4 text-foreground leading-relaxed pl-3">{r.sentence}</h3>
                  {showRecordingTrans[idx] && (
                    <p className="text-sm text-muted-foreground mb-6 bg-slate-50 p-3 rounded-lg">{r.translation}</p>
                  )}
                  
                  <div className="space-y-3 mb-4 mt-6">
                    <button className="flex items-center justify-center bg-secondary text-secondary-foreground rounded-2xl py-4 px-4 w-full transition-opacity hover:opacity-90">
                      <Volume2 className="w-5 h-5 mr-4" />
                      <div className="flex gap-[3px] items-center h-5">
                        {[1, 2, 3, 5, 3, 2, 4, 6, 8, 6, 4, 5, 7, 5, 3, 4, 6, 4, 2, 3, 2, 1].map((h, i) => (
                          <div key={`read-${i}`} className="w-[3px] bg-secondary-foreground/40 rounded-full" style={{ height: `${h * 3}px` }} />
                        ))}
                      </div>
                    </button>
                  </div>

                  {r.lowWords.length > 0 ? (
                    <p className="text-base mt-6 text-muted-foreground pl-3">
                      {r.sentence.split(/(\s+)/).map((word, i) => {
                        const clean = word.replace(/[.,!?]/g, "");
                        const isLow = r.lowWords.includes(clean);
                        return isLow ? (
                          <span key={i} className="text-muted-foreground">{word}</span>
                        ) : (
                          word.trim() === "" ? <span key={i}>{word}</span> : <span key={i} className="text-success font-medium">{word}</span>
                        );
                      })}
                    </p>
                  ) : (
                    <p className="text-base mt-6 font-medium text-success pl-3">
                      You said it perfectly.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 하단 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
        <Button variant="outline" className="w-full sm:w-auto min-w-[200px] h-14 text-base rounded-xl font-medium" size="lg">
          <Home className="w-4 h-4 mr-2" /> 대시보드로 돌아가기
        </Button>
        <Button className="w-full sm:w-auto min-w-[200px] h-14 text-base rounded-xl bg-[#A399F7] hover:bg-[#A399F7]/90 text-white shadow-md font-bold" size="lg">
          새 퀴즈 풀기 ✨
        </Button>
      </div>
    </div>
  );
}
