import { describe, expect, it } from "vitest";
import { gopherOverlay } from "./gopherOverlay";

// The overlay only reads `tag`, `isCracked`, `isEmpty` off the cell, so a
// partial cast keeps the fixtures small.
const cell = (over: Record<string, unknown>) => over as never;

describe("gopherOverlay", () => {
  it("returns undefined for an untagged cell", () => {
    expect(gopherOverlay("0,0", cell({}))).toBeUndefined();
  });

  it("paints the initial and revealed gopher glyphs", () => {
    expect(gopherOverlay("0,0", cell({ tag: "initial" }))).toEqual({
      node: "🐁",
      className: "gopher",
    });
    expect(gopherOverlay("0,0", cell({ tag: "revealed" }))).toEqual({
      node: "🐀",
      className: "gopher",
    });
  });

  it("paints a trap for a gopher-cracked rock", () => {
    expect(gopherOverlay("0,0", cell({ tag: "hit", isCracked: true }))).toEqual({
      node: "🪤",
      className: "gopher",
    });
  });

  it("paints cheese for a gopher-emptied soil", () => {
    expect(gopherOverlay("0,0", cell({ tag: "hit", isEmpty: true }))).toEqual({
      node: "🧀",
      className: "gopher",
    });
  });

  it("leaves the node undefined for a gopher-revealed item (falls through to keycap)", () => {
    expect(gopherOverlay("0,0", cell({ tag: "hit" }))).toEqual({
      node: undefined,
      className: "gopher",
    });
  });
});
