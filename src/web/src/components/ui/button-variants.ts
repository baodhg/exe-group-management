import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        outline: "border-input bg-card font-semibold text-foreground hover:bg-muted aria-expanded:bg-muted",
        ghost: "font-semibold text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive: "bg-danger-soft text-danger-ink hover:bg-danger-soft/70 focus-visible:ring-destructive",
        link: "h-auto rounded-none p-0 font-semibold text-ink underline-offset-4 hover:underline disabled:bg-transparent",
      },
      size: {
        default: "h-10 px-5",
        xs: "h-[26px] gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-[46px] px-[26px] text-[15px]",
        icon: "size-10",
        "icon-xs": "size-[26px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-[46px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
