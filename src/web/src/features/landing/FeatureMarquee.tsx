import { cn } from "@/lib/utils";
import { marqueeTags } from "./landingContent";
import { Wrap } from "./parts";

function TagRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2 pr-2 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0", className)}>
      {marqueeTags.map(({ icon: Icon, label }) => (
        <span key={label} className="inline-flex min-h-[34px] items-center gap-[7px] rounded-full border bg-card px-3.5 text-[13px] font-semibold text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

export function FeatureMarquee() {
  return (
    <Wrap>
      <div aria-hidden className="flex overflow-hidden whitespace-nowrap mask-x-from-88% mask-x-to-100% motion-reduce:mask-none">
        <div className="inline-flex min-w-max animate-out slide-out-to-left-1/2 duration-[42s] ease-linear repeat-infinite hover:paused motion-reduce:w-full motion-reduce:min-w-0 motion-reduce:animate-none">
          <TagRow />
          <TagRow className="motion-reduce:hidden" />
        </div>
      </div>
    </Wrap>
  );
}
