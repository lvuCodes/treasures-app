import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  applyTheme,
  isThemeId,
  loadTheme,
  saveTheme,
} from "./theme";

// The default vitest env is node — no window/localStorage/document. We stub
// exactly what each test needs and restore afterward.
afterEach(() => {
  vi.unstubAllGlobals();
});

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe("THEMES catalog", () => {
  it("lists all nine themes with grass first as the default", () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      "grass",
      "homebrew",
      "pro",
      "ocean",
      "red-sands",
      "man-page",
      "novel",
      "silver-aerogel",
      "basic",
    ]);
    expect(DEFAULT_THEME).toBe("grass");
    expect(THEMES[0].id).toBe(DEFAULT_THEME);
  });
});

describe("isThemeId", () => {
  it("accepts every catalog id", () => {
    for (const { id } of THEMES) expect(isThemeId(id)).toBe(true);
  });

  it("rejects unknown values and nullish input", () => {
    expect(isThemeId("solarized")).toBe(false);
    expect(isThemeId("")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});

describe("loadTheme", () => {
  it("returns the default when storage is empty", () => {
    stubStorage();
    expect(loadTheme()).toBe(DEFAULT_THEME);
  });

  it("returns a stored valid id", () => {
    stubStorage({ [THEME_STORAGE_KEY]: "ocean" });
    expect(loadTheme()).toBe("ocean");
  });

  it("falls back to the default for a stored invalid id", () => {
    stubStorage({ [THEME_STORAGE_KEY]: "solarized" });
    expect(loadTheme()).toBe(DEFAULT_THEME);
  });

  it("returns the default when localStorage is unavailable", () => {
    // No stub — referencing the missing global throws, which loadTheme swallows.
    expect(loadTheme()).toBe(DEFAULT_THEME);
  });
});

describe("saveTheme", () => {
  it("round-trips through storage", () => {
    const store = stubStorage();
    saveTheme("homebrew");
    expect(store.get(THEME_STORAGE_KEY)).toBe("homebrew");
    expect(loadTheme()).toBe("homebrew");
  });

  it("does not throw when storage is unavailable", () => {
    expect(() => saveTheme("pro")).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("sets <html data-theme> and persists the choice", () => {
    const store = stubStorage();
    const root = { dataset: {} as Record<string, string> };
    vi.stubGlobal("document", { documentElement: root });

    applyTheme("red-sands");

    expect(root.dataset.theme).toBe("red-sands");
    expect(store.get(THEME_STORAGE_KEY)).toBe("red-sands");
  });
});
