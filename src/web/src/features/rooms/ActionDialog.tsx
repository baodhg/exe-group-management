import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ActionDialog({
  title,
  description,
  icon: Icon,
  confirmLabel,
  pendingLabel,
  pending = false,
  disabled = false,
  destructive = false,
  onConfirm,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  icon: LucideIcon;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) {
          onClose();
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!pending && !disabled) {
              onConfirm();
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Huỷ
            </AlertDialogCancel>
            <Button type="submit" variant={destructive ? "destructive" : "default"} pending={pending} disabled={disabled}>
              {!pending && <Icon aria-hidden />}
              {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
