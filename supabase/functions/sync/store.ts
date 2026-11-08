import type { SaveRows } from "./handler.ts";

// Saves the checked rows by calling public.apply_sync() through the Supabase Data API, with the
// project's secret key. Supabase gives every server function SUPABASE_URL and SUPABASE_SECRET_KEYS
// automatically; nothing has to be configured for this.
export function databaseSaver(
  supabaseUrl: string | undefined,
  secretKeys: string | undefined,
  fetchFn: typeof fetch = fetch,
): SaveRows {
  return async (programmes, alumni) => {
    if (!supabaseUrl) throw new Error("SUPABASE_URL is missing.");
    const response = await fetchFn(`${supabaseUrl}/rest/v1/rpc/apply_sync`, {
      method: "POST",
      // Secret keys go in the apikey header only (not in Authorization).
      headers: { "apikey": readSecretKey(secretKeys), "Content-Type": "application/json" },
      body: JSON.stringify({ new_programmes: programmes, new_alumni: alumni }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = [body?.message, body?.hint].filter(Boolean).join(" ");
      throw new Error(reason || `The database answered with status ${response.status}.`);
    }
    return { programmes: Number(body?.programmes), alumni: Number(body?.alumni) };
  };
}

// SUPABASE_SECRET_KEYS is a JSON object with the project's secret keys by name, for example
// {"default": "sb_secret_..."}. The key named "default" is used, or else the first one.
export function readSecretKey(secretKeys: string | undefined): string {
  let keys: unknown;
  try {
    keys = JSON.parse(secretKeys ?? "");
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS is missing.");
  }
  const named = (typeof keys === "object" && keys !== null ? keys : {}) as Record<string, unknown>;
  const key = named["default"] ?? Object.values(named)[0];
  if (typeof key !== "string" || key === "") throw new Error("SUPABASE_SECRET_KEYS holds no key.");
  return key;
}
