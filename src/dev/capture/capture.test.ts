import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCapture } from "./capture";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveCapture", () => {
  it("posts the payload and reports the written file on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ file: "captures/map.json" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const msg = await saveCapture("gopher", { a: 1 });

    expect(msg).toBe("💾 Saved to captures/map.json");
    expect(fetchMock).toHaveBeenCalledWith(
      "/__capture",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ kind: "gopher", data: { a: 1 } }),
      }),
    );
  });

  it("reports failure when the server responds non-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect(await saveCapture("x", {})).toBe("⚠️ Save failed — is the dev server running?");
  });

  it("reports failure when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await saveCapture("x", {})).toBe("⚠️ Save failed — is the dev server running?");
  });
});
