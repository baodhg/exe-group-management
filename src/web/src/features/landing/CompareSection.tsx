import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { comparisons } from "./landingContent";
import { DisplayHeading, revealClass, Wrap } from "./parts";

export function CompareSection() {
  return (
    <section className="dark bg-card py-18 text-foreground">
      <Wrap className="flex flex-wrap items-stretch gap-4">
        <div className={cn("min-w-0 flex-[1_1_300px]", revealClass)}>
          <DisplayHeading>Bỏ nhóm chat và bảng tính khỏi khâu lập nhóm</DisplayHeading>
        </div>
        <ul className="flex min-w-0 flex-[3_1_540px] flex-col divide-y">
          {comparisons.map((row) => (
            <li key={row.before} className="grid gap-4 py-3.5 text-sm/[1.55] sm:grid-cols-2">
              <span className="flex items-start gap-2 text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0" aria-hidden />
                {row.before}
              </span>
              <strong className="flex items-start gap-2 font-bold text-success-ink">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                {row.after}
              </strong>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}
