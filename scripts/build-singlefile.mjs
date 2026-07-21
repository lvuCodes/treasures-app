// Inlines the Vite build (dist/) into a single self-contained HTML file that
// runs by double-click over file:// — no server, no separate asset files.
// Usage: npm run build && node scripts/build-singlefile.mjs
// Output: treasures-app.html at the project root.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");

const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));
if (!jsFile || !cssFile)
  throw new Error("dist/assets missing JS or CSS — run `npm run build` first");

const js = readFileSync(join(assets, jsFile), "utf8");
const css = readFileSync(join(assets, cssFile), "utf8");

let html = readFileSync(join(dist, "index.html"), "utf8");

// Collapse the icon links into one inlined data URI — external icon files don't
// ship with the single-file distribution, so they'd 404 over file://.
const icon = readFileSync(join(dist, "favicon-32.png")).toString("base64");
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, "");
html = html.replace(/\s*<link rel="icon"[^>]*>/g, "");
html = html.replace(
  "<head>",
  () => `<head>\n    <link rel="icon" type="image/png" href="data:image/png;base64,${icon}" />`,
);
// Inline the stylesheet. Use a replacement FUNCTION so `$` sequences in the
// asset text are inserted verbatim (a string replacement treats $&, $`, $' etc.
// as special patterns — the minified bundle is full of them).
html = html.replace(
  /\s*<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+"[^>]*>/,
  () => `\n    <style>\n${css}\n    </style>`,
);
// Inline the module script (escape any literal </script> in the bundle so it
// can't close the inline <script> early), again via a replacement function.
const safeJs = js.replace(/<\/script>/g, "<\\/script>");
html = html.replace(
  /\s*<script type="module"[^>]*src="\.\/assets\/[^"]+"[^>]*><\/script>/,
  () => `\n    <script type="module">\n${safeJs}\n    </script>`,
);

// Subset-release invariant: the dev-only feature (src/dev/) must NOT ship in the
// production bundle. Grep the final HTML for dev sentinels — glyphs, the capture
// endpoint, and dev CSS/UI strings that only exist under src/dev/. If any survive,
// tree-shaking failed (a stray reference outside an import.meta.env.DEV guard, or
// a side-effect import at the dev barrel), so fail the build loudly.
const DEV_SENTINELS = [
  "🐁", // initial gopher glyph
  "🐀", // revealed gopher glyph
  "🧀", // gopher-emptied soil glyph
  "🪤", // gopher-cracked rock glyph
  "/__capture", // dev capture endpoint
  "Save map state", // dev capture button
  "Export saved maps", // dev capture button
  "Initial gopher", // dev gopher button
];
const leaked = DEV_SENTINELS.filter((s) => html.includes(s));
if (leaked.length) {
  throw new Error(
    `Dev-only code leaked into the production bundle: ${leaked.join(", ")}.\n` +
      "The src/dev/ folder must be tree-shaken out — check that every dev reference " +
      "sits behind an import.meta.env.DEV guard and that the dev barrel has no " +
      "side-effect (CSS) imports.",
  );
}

const out = join(root, "treasures-app.html");
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(1)} kB) — no dev sentinels`);
