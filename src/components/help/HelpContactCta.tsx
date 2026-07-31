import { FeedbackButton } from "@/components/feedback/FeedbackButton";

export function HelpContactCta() {
  return (
    <section className="border-t border-border bg-card py-16 md:py-20">
      <div className="container max-w-3xl text-center">
        <h2 className="mb-2 text-2xl font-black tracking-tight text-foreground break-keep">
          원하는 답을 찾지 못하셨나요?
        </h2>
        <p className="mx-auto mb-6 max-w-sm text-[15px] leading-relaxed text-muted-foreground break-keep">
          궁금한 점을 남겨주시면 확인 후 답변드릴게요.
        </p>
        <FeedbackButton context="help_center" label="피드백 보내기" variant="default" size="lg" />
      </div>
    </section>
  );
}
