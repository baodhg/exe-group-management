import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const storageKey = "exe-group.theme";
const listeners = new Set<() => void>();

export function readTheme(storage: Pick<Storage, "getItem"> | null = safeStorage()): Theme {
  try {
    return storage?.getItem(storageKey) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeTheme(theme: Theme, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(storageKey, theme);
  } catch {
    return;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

let current: Theme = readTheme();

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setTheme(theme: Theme): void {
  current = theme;
  writeTheme(theme);
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, () => current);
  return { theme, setTheme: useCallback((next: Theme) => setTheme(next), []) };
}
