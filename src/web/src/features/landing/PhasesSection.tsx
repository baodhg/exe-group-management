import { cn } from "@/lib/utils";
import { phases } from "./landingContent";
import { DisplayHeading, paragraphClass, revealClass, Wrap } from "./parts";

export function PhasesSection() {
  return (
    <section id="how" className="py-18">
      <Wrap className="flex flex-col gap-8">
        <div className={cn("flex max-w-[44rem] flex-col gap-3", revealClass)}>
          <DisplayHeading>Bốn giai đoạn, một danh sách cuối cùng</DisplayHeading>
          <p className="text-base/[1.55] text-muted-foreground">Mỗi giai đoạn chỉ mở đúng những việc cần làm, nên không ai phải đoán bước tiếp theo.</p>
        </div>
        <ol className="grid list-none grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-6">
          {phases.map(({ icon: Icon, title, text }) => (
            <li key={title} className={cn("flex flex-col gap-2.5", revealClass)}>
              <span className="inline-flex size-10 items-center justify-center rounded-full border border-input text-ink" aria-hidden>
                <Icon className="size-[18px]" />
              </span>
              <strong className="text-lg/[1.3] font-extrabold tracking-[-0.015em]">{title}</strong>
              <span className={paragraphClass}>{text}</span>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}
