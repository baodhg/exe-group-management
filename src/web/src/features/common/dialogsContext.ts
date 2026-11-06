import { createContext, useContext, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
}

export interface AskTextOptions extends ConfirmOptions {
  label: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

export interface Dialogs {
  confirm(options: ConfirmOptions): Promise<boolean>;
  askText(options: AskTextOptions): Promise<string | null>;
}

export const DialogsContext = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogsContext);
  if (!dialogs) {
    throw new Error("useDialogs must be used inside <DialogsProvider>.");
  }

  return dialogs;
}
