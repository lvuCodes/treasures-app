#!/usr/bin/env node
// Regenerates AI-USAGE.md from the edit ledger and git history. Zero-dependency and
// vendored deliberately: CI runs it without the machine-global hooks in
// ~/.claude/hooks/ai-attribution/ that write the ledger in the first place.
//
//   node scripts/ai-attribution.mjs           # rewrite the report
//   node scripts/ai-attribution.mjs --check    # exit non-zero when it is stale (CI)
//
// Spec: ~/dev/reference-material/ai-attribution-and-disclosure-spec.md
import { readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isMain = (metaUrl) => {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
};

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const git = (root, args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });

// `**` crosses separators, `*` and `?` do not — the same matcher the hooks apply, so
// a path excluded from the ledger is excluded from the denominator too.
export const globToRe = (glob) => {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i += 1;
        if (glob[i + 1] === "/") {
          out += "(?:.*/)?";
          i += 1;
        } else out += ".*";
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
};

export const isExcluded = (path, patterns = []) => patterns.some((p) => globToRe(p).test(path));

// "12\t3\tsrc/app.ts" per changed file; a binary file reports "-" and is skipped
// rather than counted as zero, so it never dilutes the percentages.
export const parseNumstat = (text, exclude = []) => {
  let added = 0;
  for (const line of text.split("\n")) {
    const [a, , path] = line.split("\t");
    if (!path || a === "-") continue;
    if (isExcluded(path, exclude)) continue;
    added += Number(a) || 0;
  }
  return added;
};

export const AUTHOR = "\0author ";

export const withoutAuthors = (text, authors = []) => {
  let skip = false;
  return text
    .split("\n")
    .filter((line) => {
      if (line.startsWith(AUTHOR)) {
        skip = authors.includes(line.slice(AUTHOR.length));
        return false;
      }
      return !skip;
    })
    .join("\n");
};

// A file Claude created but nobody has staged is in the ledger yet in no git diff, so
// without this its lines would count as AI-added out of a denominator missing them.
export const untrackedAdded = (
  root,
  exclude = [],
  read = (p) => readFileSync(join(root, p), "utf8"),
) => {
  let added = 0;
  for (const path of git(root, ["ls-files", "--others", "--exclude-standard"]).split("\n")) {
    if (!path || isExcluded(path, exclude)) continue;
    try {
      const text = read(path);
      if (text.includes("\0")) continue; // binary
      added += text.split("\n").filter((l, i, all) => i < all.length - 1 || l !== "").length;
    } catch {
      /* unreadable is not countable */
    }
  }
  return added;
};

export const readLedger = (root) => {
  const file = join(root, ".ai-attribution", "ledger.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null; // a torn append is one lost edit, not a failed report
      }
    })
    .filter(Boolean);
};

// An entry counts when the commit it was made against is the baseline or a descendant
// of it. A head git no longer knows — a rebased or dropped commit — counts too: over-
// attributing to the assistant is the honest direction for a disclosure to err in.
export const attributableAdded = (entries, { root, baseline, exclude = [], isAncestor }) => {
  const ancestor =
    isAncestor ||
    ((base, head) => {
      try {
        git(root, ["merge-base", "--is-ancestor", base, head]);
        return true;
      } catch (err) {
        // Exit 1 is git's answer, not its failure: the commit is known and is not a
        // descendant. Anything else (a missing object, a rewritten history) is unknown.
        return err.status === 1 ? false : null;
      }
    });
  const known = new Map();
  let added = 0;
  for (const e of entries) {
    if (!e || isExcluded(e.file, exclude)) continue;
    if (e.head) {
      if (!known.has(e.head)) known.set(e.head, ancestor(baseline, e.head));
      if (known.get(e.head) === false) continue;
    }
    added += Number(e.added) || 0;
  }
  return added;
};

export const coAuthoredAdded = (root, baseline, exclude = [], run = (args) => git(root, args)) =>
  parseNumstat(
    run([
      "log",
      "--numstat",
      "--no-renames",
      "--format=",
      "-i",
      "--grep=^Co-Authored-By: Claude",
      `${baseline}..HEAD`,
    ]),
    exclude,
  );

const CONVENTIONAL = /^(\w+)(?:\([^)]*\))?!?:/;

// Unit and record separators keep subjects and trailer values that contain commas intact.
export const CHANGE_FORMAT =
  "%x00%P%x1f%an%x1f%ae%x1f%s%x1f%(trailers:key=Change-Type,valueonly,separator=%x1e)%x1f%(trailers:key=Co-Authored-By,valueonly,separator=%x1e)";

export const changeType = ({ trailer = "", parents = 1, subject = "" }) => {
  const labelled = trailer.split("\x1e")[0].trim().toLowerCase();
  if (labelled) return labelled;
  if (parents > 1) return "merge";
  const match = CONVENTIONAL.exec(subject);
  return match ? match[1].toLowerCase() : "unlabeled";
};

export const parseChanges = (text, { exclude = [], excludeAuthors = [] } = {}) => {
  const byType = new Map();
  for (const chunk of text.split("\0").filter(Boolean)) {
    const nl = chunk.indexOf("\n");
    const [parents = "", name = "", email = "", subject = "", trailer = "", coAuthors = ""] = (
      nl === -1 ? chunk : chunk.slice(0, nl)
    ).split("\x1f");
    if (/\[bot\]@/.test(email) || excludeAuthors.includes(name)) continue;
    const numstat = nl === -1 ? "" : chunk.slice(nl + 1);
    // A commit touching only excluded paths, like the report's own regeneration, would
    // otherwise make every freshly committed report stale.
    const counted = numstat.split("\n").some((line) => {
      const [a, , path] = line.split("\t");
      return path && a !== "-" && !isExcluded(path, exclude);
    });
    if (!counted) continue;
    const added = parseNumstat(numstat, exclude);
    const type = changeType({
      trailer,
      parents: parents.split(" ").filter(Boolean).length,
      subject,
    });
    const row = byType.get(type) || { type, commits: 0, claude: 0, author: 0 };
    row.commits += 1;
    if (coAuthors.split("\x1e").some((v) => /^claude\b/i.test(v.trim()))) row.claude += added;
    else row.author += added;
    byType.set(type, row);
  }
  return [...byType.values()].sort(
    (a, b) => b.claude + b.author - (a.claude + a.author) || a.type.localeCompare(b.type),
  );
};

// remerge shows a merge commit's own conflict resolution, not the branch it brought in.
export const changesSince = (root, baseline, options, run = (args) => git(root, args)) =>
  parseChanges(
    run([
      "log",
      "--numstat",
      "--no-renames",
      "--diff-merges=remerge",
      `--format=${CHANGE_FORMAT}`,
      `${baseline}..HEAD`,
    ]),
    options,
  );

export const changesSection = (changes = []) => {
  const rows = changes.length
    ? changes
        .map(
          (c) =>
            `| \`${c.type}\` | ${c.commits} | ${c.claude.toLocaleString("en-US")} | ${c.author.toLocaleString("en-US")} |`,
        )
        .join("\n")
    : "| _none_ | 0 | 0 | 0 |";
  return `## Changes by Type

| Change type | Commits | By Claude | By the author |
|---|---|---|---|
${rows}
`;
};

export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

const TIMESTAMP = "_Generated ";

export const buildReport = ({ config, aiAdded, totalAdded, generatedAt, changes = [] }) => {
  // The ledger counts every edit; the diff counts what survived. Rewriting its own work
  // can push Claude's tally past the net total, and a share over 100% is nonsense — so
  // it is capped, and the raw tally is stated rather than quietly discarded.
  const counted = Math.min(aiAdded, totalAdded);
  const humanAdded = Math.max(0, totalAdded - counted);
  const headline =
    totalAdded === 0
      ? "**0% AI, 0% human** — no attributed changes since the baseline."
      : `**${percent(counted, totalAdded)}% AI, ${percent(humanAdded, totalAdded)}% human**, by lines added since the baseline commit.`;
  const capped =
    aiAdded > totalAdded
      ? `\nThe ledger recorded **${aiAdded.toLocaleString("en-US")}** lines across individual edits, more than the ${totalAdded.toLocaleString("en-US")} net lines added since the baseline — a line written and then rewritten counts twice in the ledger and once in the diff. Claude's share is capped at 100% rather than reported above it.\n`
      : "";
  return `# AI Usage

${headline}

| Measure | Lines added |
|---|---|
| **By Claude** | ${counted.toLocaleString("en-US")} |
| **By the author** | ${humanAdded.toLocaleString("en-US")} |
| **Total since baseline** | ${totalAdded.toLocaleString("en-US")} |
${capped}
Baseline commit \`${config.baselineCommit.slice(0, 7)}\` (${config.baselineDate}). Regenerate with \`node scripts/ai-attribution.mjs\`.

${changesSection(changes)}
## Measurement Scope

- The figures count **lines added since the baseline commit**, not lines currently surviving in the working tree. A line written once and rewritten twice is counted three times.
- Everything committed **before the baseline** is unattributed and appears in no column. Authorship there cannot be honestly reconstructed, so it is not guessed at.
- Claude's lines are the larger of two counts: edits the ledger recorded through **Claude Code's own editing tools**, and every line added by a commit carrying a \`Co-Authored-By: Claude\` trailer. Anything else counts as the author's.
- Change types come from each commit's \`Change-Type:\` trailer, otherwise its conventional-commit prefix (\`fix\`, \`ci\`, \`docs\`), otherwise \`unlabeled\`. A merge commit without a trailer is \`merge\`, and its lines are only those its conflict resolution added. Per-type lines follow the \`Co-Authored-By: Claude\` trailer alone, so their Claude total can differ from the headline, which also counts ledger edits.
- A line count is **not a claim about authorship of design or direction**. What to build, which generated output to keep, and what to reject are the author's, and none of it appears in a diff.
- Figures are computed from \`.ai-attribution/ledger.jsonl\` — an append-only record written as each edit lands — joined against \`git log --numstat\`. The ledger is committed as the evidence behind this report.

## Excluded Paths

${config.exclude.map((p) => `- \`${p}\``).join("\n")}

${TIMESTAMP}${generatedAt}.
`;
};

// The timestamp moves on every run, so staleness is judged on everything else.
export const withoutTimestamp = (text) =>
  text
    .split("\n")
    .filter((l) => !l.startsWith(TIMESTAMP))
    .join("\n");

export const generate = (root = ROOT) => {
  const config = JSON.parse(readFileSync(join(root, ".ai-attribution", "config.json"), "utf8"));
  if (config.prose && config.prose.paths && config.prose.paths.length) {
    throw new Error(
      "prose.paths is set, but this vendored generator implements the code metric only. " +
        "Implement the per-post sidecars from the spec before configuring prose paths.",
    );
  }
  const baseline = config.baselineCommit;
  // The report is always excluded from its own figures, whatever the config says: it
  // is regenerated from them, so counting it would move the number it reports.
  const exclude = [...(config.exclude || []), config.report];
  const committed = parseNumstat(
    withoutAuthors(
      git(root, [
        "log",
        "--numstat",
        "--no-renames",
        "--format=%x00author %an",
        `${baseline}..HEAD`,
      ]),
      config.excludeAuthors || [],
    ),
    exclude,
  );
  const uncommitted = parseNumstat(
    git(root, ["diff", "--numstat", "--no-renames", "HEAD"]),
    exclude,
  );
  const untracked = untrackedAdded(root, exclude);
  const aiAdded = Math.max(
    attributableAdded(readLedger(root), { root, baseline, exclude }),
    coAuthoredAdded(root, baseline, exclude),
  );
  return {
    config,
    text: buildReport({
      config,
      aiAdded,
      totalAdded: committed + uncommitted + untracked,
      changes: changesSince(root, baseline, {
        exclude,
        excludeAuthors: config.excludeAuthors || [],
      }),
      generatedAt: new Date().toISOString().slice(0, 19).replace("T", " ") + "Z",
    }),
  };
};

export const main = (argv = [], root = ROOT) => {
  const { config, text } = generate(root);
  const target = join(root, config.report);
  if (argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (withoutTimestamp(current) !== withoutTimestamp(text)) {
      console.error(`${config.report} is stale — run: node scripts/ai-attribution.mjs`);
      return 1;
    }
    console.log(`${config.report} is up to date.`);
    return 0;
  }
  writeFileSync(target, text, "utf8");
  console.log(`Wrote ${config.report}.`);
  return 0;
};

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
