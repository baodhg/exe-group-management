"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ theme = "light", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-[14px] !border-border !bg-popover !text-popover-foreground !shadow-pop !text-[13px]",
          success: "[&_[data-icon]]:!text-success-ink",
          error: "[&_[data-icon]]:!text-danger-ink",
          info: "[&_[data-icon]]:!text-info-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
