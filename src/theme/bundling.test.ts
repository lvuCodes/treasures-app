import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard: a `sideEffects` allowlist in package.json made Rollup drop
// `import "./themes.css"` from the theme barrel, so the production bundle
// shipped without a single palette token and the app rendered unstyled.
// Vite/Rollup does not honour sideEffects globs for the app's own source, so the
// field must stay absent (or `true`) — never a glob list.
describe("package.json sideEffects", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
  ) as { sideEffects?: unknown };

  it("does not narrow side effects to a glob allowlist", () => {
    expect(pkg.sideEffects === undefined || pkg.sideEffects === true).toBe(true);
  });
});
