import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "@lvucodes/ui";
import { seedDefaultTheme } from "./theme-boot";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
}

describe("seedDefaultTheme", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("seeds lvuCodes as the default when storage is empty", () => {
    seedDefaultTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("lvucodes");
  });

  it("keeps a theme the visitor already picked", () => {
    vi.stubGlobal("localStorage", memoryStorage({ [THEME_STORAGE_KEY]: "basic" }));
    seedDefaultTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("basic");
  });

  it("replaces an invalid stored value with lvuCodes", () => {
    vi.stubGlobal("localStorage", memoryStorage({ [THEME_STORAGE_KEY]: "not-a-theme" }));
    seedDefaultTheme();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("lvucodes");
  });

  it("falls back to lvuCodes when storage cannot be read", () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", storage);
    expect(() => seedDefaultTheme()).not.toThrow();
  });
});
