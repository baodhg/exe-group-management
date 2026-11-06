import { describe, expect, it } from "vitest";
import { readTheme, writeTheme } from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

describe("theme storage", () => {
  it("starts light when nothing is stored", () => {
    expect(readTheme(memoryStorage())).toBe("light");
  });

  it("keeps the chosen theme across a reload", () => {
    const storage = memoryStorage();
    writeTheme("dark", storage);
    expect(readTheme(storage)).toBe("dark");
  });

  it("falls back to light when storage throws", () => {
    const broken = { getItem: () => { throw new Error("blocked"); } };
    expect(readTheme(broken)).toBe("light");
  });
});
