import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Trash2, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText } from "../common/messages";
import { Criteria, Criterion, ErrorNote, Failure, LinkButton, Section } from "../common/ui";
import { deleteRefused, isNotFound } from "./catalogRules";

export function TableSkeleton({ heads, rows = 5 }: { heads: readonly string[]; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải">
      <Table>
        <TableHeader>
          <TableRow>
            {heads.map((head) => (
              <TableHead key={head}>{head}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {heads.map((head) => (
                <TableCell key={head}>
                  <Skeleton className="h-3 w-full max-w-40 rounded-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function PageFailure({ error, title, backTo, backLabel }: { error: unknown; title: string; backTo: string; backLabel: string }) {
  return (
    <Section>
      <Failure
        error={error}
        title={title}
        action={
          <LinkButton to={backTo} variant="outline" size="sm">
            <ArrowLeft aria-hidden />
            {backLabel}
          </LinkButton>
        }
      />
    </Section>
  );
}

export function ClearFilters({ onClear }: { onClear: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClear}>
      <X aria-hidden />
      Xoá bộ lọc
    </Button>
  );
}

export function FormDialog({
  title,
  description,
  onClose,
  onSubmit,
  canSubmit,
  pending,
  submitLabel = "Lưu",
  pendingLabel = "Đang lưu",
  icon: Icon = Save,
  note,
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  pending: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  icon?: LucideIcon;
  note?: unknown;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && !pending) {
              onSubmit();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg font-extrabold tracking-[-0.015em]">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <ErrorNote error={note} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" disabled={!canSubmit} pending={pending}>
              {!pending && <Icon aria-hidden />}
              {pending ? pendingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({
  title,
  criteria,
  columns = 2,
  confirmLabel = "Xoá",
  pendingLabel = "Đang xoá",
  successText,
  run,
  onDone,
  onClose,
}: {
  title: string;
  criteria: readonly { label: string; value: ReactNode }[];
  columns?: 2 | 3;
  confirmLabel?: string;
  pendingLabel?: string;
  successText: string;
  run: () => Promise<unknown>;
  onDone: () => Promise<unknown>;
  onClose: () => void;
}) {
  const remove = useMutation({
    mutationFn: run,
    onSuccess: async () => {
      toast.success(successText);
      onClose();
      await onDone();
    },
    onError: async (error) => {
      if (isNotFound(error)) {
        toast.error(errorText(error));
        onClose();
        await onDone();
      }
    },
  });
  const refused = deleteRefused(remove.error);

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-extrabold tracking-[-0.015em]">{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <Criteria columns={columns}>
          {criteria.map((criterion) => (
            <Criterion key={criterion.label + String(criterion.value)} label={criterion.label}>
              {criterion.value}
            </Criterion>
          ))}
        </Criteria>
        <ErrorNote error={remove.error} />
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {refused ? "Đóng" : "Huỷ"}
          </Button>
          <Button variant="destructive" disabled={refused} pending={remove.isPending} onClick={() => remove.mutate()}>
            {!remove.isPending && <Trash2 aria-hidden />}
            {remove.isPending ? pendingLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
