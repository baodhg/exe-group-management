import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { LoaderCircle } from "lucide-react"

import { buttonVariants } from "./button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  pending = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { pending?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button }
