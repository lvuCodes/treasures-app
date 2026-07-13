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
if (!jsFile || !cssFile) throw new Error("dist/assets missing JS or CSS — run `npm run build` first");

const js = readFileSync(join(assets, jsFile), "utf8");
const css = readFileSync(join(assets, cssFile), "utf8");

let html = readFileSync(join(dist, "index.html"), "utf8");

// Drop the favicon link (would point to a missing external file).
html = html.replace(/\s*<link rel="icon"[^>]*>/, "");
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

const out = join(root, "treasures-app.html");
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(1)} kB)`);
