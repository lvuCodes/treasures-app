import { describe, expect, it } from "vitest";
import pkg from "../../package.json";

// Regression guard: a `sideEffects` allowlist in package.json made Rollup drop
// `import "./themes.css"` from the theme barrel, so the production bundle
// shipped without a single palette token and the app rendered unstyled.
// Vite/Rollup does not honour sideEffects globs for the app's own source, so the
// field must stay absent (or `true`) — never a glob list.
describe("package.json sideEffects", () => {
  it("does not narrow side effects to a glob allowlist", () => {
    const sideEffects = (pkg as { sideEffects?: unknown }).sideEffects;
    expect(sideEffects === undefined || sideEffects === true).toBe(true);
  });
});
