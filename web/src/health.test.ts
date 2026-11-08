import { describe, expect, it } from "vitest";
import { fetchHealth } from "./health";

const url = "https://abcdefghijklmnopqrst.supabase.co";

function fakeFetch(status: number, body: unknown) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

describe("fetchHealth", () => {
  it("calls the health function and returns the environment", async () => {
    const { fn, calls } = fakeFetch(200, { ok: true, environment: "test" });
    await expect(fetchHealth(url, fn)).resolves.toEqual({ ok: true, environment: "test" });
    expect(calls).toEqual([`${url}/functions/v1/health`]);
  });

  it("fails on an error status", async () => {
    const { fn } = fakeFetch(503, {});
    await expect(fetchHealth(url, fn)).rejects.toThrow("Health check failed (503)");
  });

  it("fails on an unexpected body", async () => {
    const { fn } = fakeFetch(200, { ok: "yes" });
    await expect(fetchHealth(url, fn)).rejects.toThrow("Unexpected health check response");
  });
});
