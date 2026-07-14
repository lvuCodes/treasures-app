// Vitest global setup. Node 22's experimental global `localStorage` is disabled
// (no --localstorage-file), and jsdom's copy isn't reliably exposed as the bare
// `localStorage` binding the app uses — so both the app code and the tests would
// otherwise see `undefined`. Install one simple, clearable in-memory store on
// globalThis for every test environment, and reset it before each test so
// persistence assertions don't bleed across tests. Per-test `vi.stubGlobal`
// overrides (e.g. in theme.test.ts) still take precedence.
import { beforeEach } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
}

Object.defineProperty(globalThis, "localStorage", {
  value: createMemoryStorage(),
  writable: true,
  configurable: true,
});

beforeEach(() => {
  globalThis.localStorage.clear();
});
