import { describe, expect, it } from "vitest";
import mainSource from "./main.tsx?raw";
import pkg from "../package.json";

// Regression guard for a bug that shipped a completely unstyled production site.
//
// package.json declares a `sideEffects` allowlist so the dev-only folder tree-
// shakes out of the production bundle. Rollup does not honour those globs for
// first-party source, so a barrel's `import "…theme.css"` was dropped and the
// build carried zero palette tokens (--bg, --accent, --item-N). Dev mode never
// showed it, because Vite does not tree-shake there.
//
// The contract is threefold: the palette is imported from the entry module
// (never shaken) as the FIRST stylesheet, the site's own index.css comes AFTER
// the App import so its rules win the equal-specificity cascade on source order,
// and the `sideEffects` allowlist stays (it strips src/dev/).
describe("theme stylesheet bundling", () => {
  it("imports the @lvucodes/ui palette before the App import", () => {
    const themeIdx = mainSource.indexOf('"@lvucodes/ui/theme.css"');
    const appIdx = mainSource.indexOf('from "./App.tsx"');
    expect(themeIdx).toBeGreaterThanOrEqual(0);
    expect(appIdx).toBeGreaterThanOrEqual(0);
    expect(themeIdx).toBeLessThan(appIdx);
  });

  it("imports the site index.css after the App import", () => {
    const appIdx = mainSource.indexOf('from "./App.tsx"');
    const indexIdx = mainSource.indexOf('"./index.css"');
    expect(indexIdx).toBeGreaterThan(appIdx);
  });

  it("keeps the sideEffects allowlist that strips the dev folder", () => {
    expect(pkg.sideEffects).toContain("**/*.css");
  });
});
