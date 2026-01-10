import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizWordsProps {
  words: string[];
}

export function QuizWords({ words }: QuizWordsProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">단어 목록</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {words.map((word, idx) => (
            <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
              {word}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
