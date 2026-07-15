// Dev-only capture client: POST an export payload to the dev server's capture
// endpoint, which writes it to captures/ on disk (see vite.config.ts). Returns a
// status string for the UI. This whole folder is referenced only behind
// import.meta.env.DEV, so it is tree-shaken out of the production build.
export async function saveCapture(kind: string, data: unknown): Promise<string> {
  try {
    const res = await fetch("/__capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, data }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { file } = await res.json();
    return `💾 Saved to ${file}`;
  } catch {
    return "⚠️ Save failed — is the dev server running?";
  }
}
