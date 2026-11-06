import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { faqs } from "./landingContent";
import { DisplayHeading, paragraphClass, revealClass, Wrap } from "./parts";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="pb-18">
      <Wrap className="flex flex-wrap items-stretch gap-4">
        <DisplayHeading className={cn("min-w-0 flex-[1_1_300px]", revealClass)}>Hỏi đáp</DisplayHeading>
        <ul className="flex min-w-0 flex-[3_1_540px] flex-col divide-y">
          {faqs.map(({ question, answer }, index) => {
            const open = index === openIndex;
            return (
              <li key={question} className="py-2.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg py-3 text-left text-[15px]/[1.4] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{question}</span>
                  <ChevronDown className={cn("size-5 shrink-0 text-ink transition-transform", open && "rotate-180")} aria-hidden />
                </button>
                {open && <p className={paragraphClass}>{answer}</p>}
              </li>
            );
          })}
        </ul>
      </Wrap>
    </section>
  );
}
