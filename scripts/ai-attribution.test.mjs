import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { main, parseNumstat, withoutAuthors } from "./ai-attribution.mjs";

const log = [
  "\0author Lauren Vu",
  "",
  "10\t2\tsrc/app.ts",
  "\0author dependabot[bot]",
  "",
  "40\t30\tpackage-lock.json",
  "1\t1\tpackage.json",
  "\0author Lauren Vu",
  "",
  "3\t0\tsrc/other.ts",
].join("\n");

describe("withoutAuthors", () => {
  it("drops the numstat of commits by an excluded author", () => {
    expect(parseNumstat(withoutAuthors(log, ["dependabot[bot]"]))).toBe(13);
  });

  it("keeps every commit when no author is excluded", () => {
    expect(parseNumstat(withoutAuthors(log))).toBe(54);
  });
});

describe("main", () => {
  it("leaves the report current after a commit by an excluded author", () => {
    const root = mkdtempSync(join(tmpdir(), "ai-attr-"));
    const git = (args, name = "Lauren Vu") =>
      execFileSync(
        "git",
        ["-C", root, "-c", `user.name=${name}`, "-c", "user.email=a@b.c", ...args],
        {
          encoding: "utf8",
        },
      );
    const commit = (file, lines, name) => {
      if (lines !== null) writeFileSync(join(root, file), "x\n".repeat(lines));
      git(["add", "-A"]);
      git(["commit", "-qm", file], name);
    };
    try {
      git(["init", "-q"]);
      commit("base.ts", 1);
      const baseline = git(["rev-parse", "HEAD"]).trim();
      mkdirSync(join(root, ".ai-attribution"));
      writeFileSync(
        join(root, ".ai-attribution", "config.json"),
        JSON.stringify({
          baselineCommit: baseline,
          baselineDate: "2026-10-05",
          report: "AI-USAGE.md",
          excludeAuthors: ["dependabot[bot]"],
          exclude: [".ai-attribution/**"],
        }),
      );
      commit("app.ts", 4);
      expect(main([], root)).toBe(0);
      commit("AI-USAGE.md", null);
      expect(main(["--check"], root)).toBe(0);
      commit("package.json", 50, "dependabot[bot]");
      expect(main(["--check"], root)).toBe(0);
      commit("human.ts", 2);
      expect(main(["--check"], root)).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
