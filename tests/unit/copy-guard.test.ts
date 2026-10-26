import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Verdict talks about how skin looks, never about medicine. This guard scans
 * every user-facing source file and fails the build on medical claims or
 * emoji. The disclaimer sentence that explicitly denies these claims is the
 * only allowed exception.
 */

const ROOTS = ["src/app", "src/components", "src/lib/domain", "src/lib/youcam", "src/lib/mcp"];
const BANNED = [/\bcures?\b/i, /\bheals?\b/i, /\btreat(s|ment|ing)?\b/i, /\bdiagnos(e|is|es|ing)\b/i, /\bprescri(be|ption)\b/i, /\bclinically proven\b/i, /\bguarantee/i];
const ALLOWED_LINES = [/does not diagnose or treat any condition/, /not a diagnosis/, /is not a medical device/];
const EMOJI = /\p{Extended_Pictographic}/u;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|md)$/.test(name) ? [p] : [];
  });
}

/** String literals and JSX text only, so code identifiers are not flagged. */
function userText(source: string): string[] {
  const noComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const literals = [...noComments.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]!);
  const jsxText = [...noComments.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]!);
  return [...literals, ...jsxText].map((s) => s.trim()).filter(Boolean);
}

describe("copy guard", () => {
  const all = ROOTS.flatMap(files);

  it("finds the source files", () => {
    expect(all.length).toBeGreaterThan(10);
  });

  it.each(all)("%s makes no medical claims and uses no emoji", (file) => {
    const text = userText(readFileSync(file, "utf8"));
    const problems = text.filter((t) => !ALLOWED_LINES.some((a) => a.test(t))).filter((t) => BANNED.some((b) => b.test(t)) || EMOJI.test(t));
    expect(problems).toEqual([]);
  });
});
