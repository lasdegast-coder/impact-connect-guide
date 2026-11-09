import { type AlumnusRow, checkSyncRequest, type ProgrammeRow, RequestError } from "./validate.ts";

// Receives programmes and alumni from the Apps Script in Impact Connect's Google account, checks
// every value, saves the rows that are correct and answers with a report of the problems.
// The Apps Script proves who it is with a shared secret in the x-sync-secret header. The secret
// is stored in Supabase (Edge Functions → Secrets → SYNC_SECRET) and in the Apps Script's Script
// Properties, never in this repository.

export type SaveRows = (
  programmes: ProgrammeRow[],
  alumni: AlumnusRow[],
) => Promise<{ programmes: number; alumni: number }>;

export type SyncDependencies = {
  environment: string | undefined;
  syncSecret: string | undefined;
  save: SaveRows;
};

const MIN_SECRET_LENGTH = 32;
const MAX_REQUEST_LENGTH = 5_000_000;

export async function handleSync(request: Request, deps: SyncDependencies): Promise<Response> {
  if (request.method !== "POST") {
    return reply(405, { ok: false, error: "Send the data with POST." });
  }

  const expectedSecret = deps.syncSecret ?? "";
  if (expectedSecret.length < MIN_SECRET_LENGTH) {
    console.error("sync: SYNC_SECRET is missing or too short");
    return reply(500, {
      ok: false,
      error: `The sync is not set up yet: SYNC_SECRET (at least ${MIN_SECRET_LENGTH} characters) is missing in Supabase.`,
    });
  }
  if (!(await sameSecret(request.headers.get("x-sync-secret") ?? "", expectedSecret))) {
    console.warn("sync: refused a request with a wrong or missing secret");
    return reply(401, { ok: false, error: "Wrong or missing sync secret." });
  }

  const text = await request.text();
  if (text.length > MAX_REQUEST_LENGTH) {
    return reply(413, { ok: false, error: "The request is too large." });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "The request is not valid JSON." });
  }

  let checked;
  try {
    checked = checkSyncRequest(body);
  } catch (error) {
    if (!(error instanceof RequestError)) throw error;
    console.warn(`sync: refused the request: ${error.message}`);
    return reply(400, { ok: false, error: error.message });
  }

  const environment = deps.environment ?? "unknown";
  const leftOut = {
    programmes: checked.received.programmes - checked.programmes.length,
    alumni: checked.received.alumni - checked.alumni.length,
  };

  let saved;
  try {
    saved = await deps.save(checked.programmes, checked.alumni);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`sync (${environment}): saving failed: ${message}`);
    return reply(500, {
      ok: false,
      environment,
      error: `Saving failed, so nothing was changed. ${message}`,
      received: checked.received,
      leftOut,
      problems: checked.problems,
      notes: checked.notes,
    });
  }

  // Only counts go to the log, never the data itself.
  console.log(
    `sync (${environment}): saved ${saved.programmes} programmes and ${saved.alumni} alumni; ` +
      `left out ${leftOut.programmes} programmes and ${leftOut.alumni} alumni; ` +
      `${checked.problems.length} problems, ${checked.notes.length} notes`,
  );
  return reply(200, {
    ok: true,
    environment,
    received: checked.received,
    saved,
    leftOut,
    problems: checked.problems,
    notes: checked.notes,
  });
}

// Compares the secrets without leaking, through response timing, how much of a guess was right.
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status });
}
