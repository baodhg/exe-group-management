import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const revealClass = "animate-in fill-mode-both fade-in slide-in-from-bottom-7 ease-linear [animation-timeline:view()] [animation-range:entry_0%_entry_70%] motion-reduce:animate-none";

export const riseClass = "animate-in fill-mode-both fade-in slide-in-from-bottom-7 duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:animate-none";

export const paragraphClass = "text-sm/[1.55] text-muted-foreground";

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-8", className)}>{children}</div>;
}

export function Glow({ className }: { className?: string }) {
  return <div className={cn("pointer-events-none absolute z-0 rounded-full bg-radial-[closest-side] from-primary/28 to-transparent", className)} aria-hidden />;
}

export function HeroTitle({ children }: { children: ReactNode }) {
  return <h1 className="relative z-0 text-[clamp(2.4rem,3.7vw,3.4rem)] leading-[1.2] font-extrabold tracking-[-0.03em]">{children}</h1>;
}

export function DisplayHeading({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn("text-[clamp(1.75rem,2.8vw,2.5rem)] leading-[1.22] font-extrabold tracking-[-0.028em] text-balance", className)}>{children}</h2>;
}
