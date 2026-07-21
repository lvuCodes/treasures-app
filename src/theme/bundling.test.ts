import { describe, expect, it } from "vitest";
import mainSource from "../main.tsx?raw";
import pkg from "../../package.json";

// Regression guard for a bug that shipped a completely unstyled production site.
//
// package.json declares a `sideEffects` allowlist so the dev-only folder tree-
// shakes out of the production bundle. Rollup does not honour those globs for
// first-party source, so the theme barrel's `import "./themes.css"` was dropped
// and the build carried zero palette tokens (--bg, --accent, --item-N). Dev mode
// never showed it, because Vite does not tree-shake there.
//
// The two settings are coupled: the allowlist must stay (it strips src/dev/) AND
// the palette must be imported from the entry module, which is never shaken.
describe("theme stylesheet bundling", () => {
  it("imports the palette from the entry module, not only the barrel", () => {
    expect(mainSource).toMatch(/import\s+["']\.\/theme\/themes\.css["']/);
  });

  it("keeps the sideEffects allowlist that strips the dev folder", () => {
    expect(pkg.sideEffects).toContain("**/*.css");
  });
});
