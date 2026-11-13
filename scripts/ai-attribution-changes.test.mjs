import { describe, expect, it } from "vitest";
import {
  buildReport,
  changesSection,
  changesSince,
  changeType,
  parseChanges,
} from "./ai-attribution.mjs";

const commit = (parents, name, email, subject, trailer, coAuthors, numstat) =>
  `\0${[parents, name, email, subject, trailer, coAuthors].join("\x1f")}\n\n${numstat}\n`;

const claude = "Claude Opus 5.5 <noreply@anthropic.com>";

const log = [
  commit(
    "a1",
    "Lauren Vu",
    "l@v.c",
    "fix(ci): run CI",
    "Dependabot-Fix",
    claude,
    "5\t1\t.github/ci.yml",
  ),
  commit(
    "a1 b2",
    "Lauren Vu",
    "l@v.c",
    "Merge main into dev",
    "merge-conflict",
    claude,
    "2\t0\tsrc/x.ts",
  ),
  commit(
    "a1",
    "dependabot[bot]",
    "1+dependabot[bot]@users.noreply.github.com",
    "chore(deps): bump",
    "",
    "",
    "40\t0\tpackage.json",
  ),
  commit(
    "a1",
    "Lauren Vu",
    "l@v.c",
    "docs: readme",
    "",
    "",
    "3\t0\tREADME.md\n9\t0\tpackage-lock.json",
  ),
  commit("a1", "Lauren Vu", "l@v.c", "Tweak colors", "", "", "4\t0\tsrc/y.ts"),
  commit("a1", "Lauren Vu", "l@v.c", "chore: regenerate", "", "", "7\t0\tpackage-lock.json"),
].join("");

describe("changeType", () => {
  it("prefers the trailer, lowercased", () => {
    expect(changeType({ trailer: "Dependabot-Fix\x1eci", parents: 1, subject: "fix: x" })).toBe(
      "dependabot-fix",
    );
  });

  it("labels an untagged merge commit as merge", () => {
    expect(changeType({ parents: 2, subject: "Merge main into dev" })).toBe("merge");
  });

  it("falls back to the conventional-commit prefix, then unlabeled", () => {
    expect(changeType({ subject: "feat(ui)!: new grid" })).toBe("feat");
    expect(changeType({ subject: "Tweak colors" })).toBe("unlabeled");
  });
});

describe("parseChanges", () => {
  it("groups lines by type, splits Claude from the author, and skips bots and excluded paths", () => {
    expect(parseChanges(log, { exclude: ["package-lock.json"] })).toEqual([
      { type: "dependabot-fix", commits: 1, claude: 5, author: 0 },
      { type: "unlabeled", commits: 1, claude: 0, author: 4 },
      { type: "docs", commits: 1, claude: 0, author: 3 },
      { type: "merge-conflict", commits: 1, claude: 2, author: 0 },
    ]);
  });

  it("skips authors named in excludeAuthors", () => {
    expect(parseChanges(log, { excludeAuthors: ["Lauren Vu"] })).toEqual([]);
  });
});

describe("changesSince", () => {
  it("reads merge commits through their conflict resolution only", () => {
    let seen;
    changesSince("/repo", "abc", {}, (args) => {
      seen = args;
      return "";
    });
    expect(seen).toContain("--diff-merges=remerge");
    expect(seen).toContain("abc..HEAD");
  });
});

describe("changesSection", () => {
  it("renders one row per type and a placeholder when empty", () => {
    expect(changesSection([{ type: "ci", commits: 2, claude: 1234, author: 0 }])).toContain(
      "| `ci` | 2 | 1,234 | 0 |",
    );
    expect(changesSection([])).toContain("| _none_ | 0 | 0 | 0 |");
  });

  it("sits in the report before the measurement scope", () => {
    const text = buildReport({
      config: { baselineCommit: "abcdef0123", baselineDate: "2026-10-01", exclude: [] },
      aiAdded: 1,
      totalAdded: 2,
      generatedAt: "now",
      changes: [{ type: "ci", commits: 1, claude: 1, author: 0 }],
    });
    expect(text.indexOf("## Changes by Type")).toBeGreaterThan(0);
    expect(text.indexOf("## Changes by Type")).toBeLessThan(text.indexOf("## Measurement Scope"));
  });
});
