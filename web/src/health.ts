export type Health = {
  ok: true;
  environment: string;
};

// Asks the server which environment (test or live) this website is connected to.
export async function fetchHealth(supabaseUrl: string, fetchFn: typeof fetch = fetch): Promise<Health> {
  const response = await fetchFn(`${supabaseUrl}/functions/v1/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  const body: unknown = await response.json();
  if (!isHealth(body)) {
    throw new Error("Unexpected health check response");
  }
  return body;
}

function isHealth(value: unknown): value is Health {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.ok === true && typeof candidate.environment === "string";
}
