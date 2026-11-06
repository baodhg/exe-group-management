import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogsContext, type AskTextOptions, type ConfirmOptions, type Dialogs } from "./dialogsContext";

type Request = { kind: "confirm"; options: ConfirmOptions } | { kind: "text"; options: AskTextOptions };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const settle = useRef<((value: string | null) => void) | null>(null);
  const fieldId = useId();

  const show = useCallback((next: Request) => {
    settle.current?.(null);
    setText("");
    setRequest(next);
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      settle.current = resolve;
    });
  }, []);

  const dialogs = useMemo<Dialogs>(
    () => ({
      confirm: async (options) => (await show({ kind: "confirm", options })) !== null,
      askText: (options) => show({ kind: "text", options }),
    }),
    [show],
  );

  function finish(value: string | null) {
    settle.current?.(value);
    settle.current = null;
    setOpen(false);
  }

  const options = request?.options;
  const asksText = request?.kind === "text" ? request.options : null;
  const answer = text.trim();
  const blocked = asksText !== null && asksText.required !== false && answer.length === 0;

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            finish(null);
          }
        }}
      >
        {options && (
          <AlertDialogContent className="sm:max-w-md">
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!blocked) {
                  finish(asksText ? answer : "");
                }
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{options.title}</AlertDialogTitle>
                {options.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
              </AlertDialogHeader>
              {asksText && (
                <div className="grid gap-2">
                  <Label htmlFor={fieldId}>{asksText.label}</Label>
                  <Textarea
                    id={fieldId}
                    value={text}
                    autoFocus
                    rows={3}
                    maxLength={asksText.maxLength}
                    placeholder={asksText.placeholder}
                    onChange={(event) => setText(event.target.value)}
                  />
                  {asksText.maxLength && (
                    <span className="tabular text-right text-xs text-muted-foreground">
                      {text.length}/{asksText.maxLength}
                    </span>
                  )}
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel type="button">Huỷ</AlertDialogCancel>
                <Button type="submit" variant={options.destructive ? "destructive" : "default"} disabled={blocked}>
                  {options.confirmLabel ?? "Đồng ý"}
                </Button>
              </AlertDialogFooter>
            </form>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </DialogsContext.Provider>
  );
}
