import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import { databaseSaver, readSecretKey } from "./store.ts";

const KEYS = JSON.stringify({ default: "sb_secret_test" });

Deno.test("saving calls apply_sync with the secret key in the apikey header", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(Response.json({ programmes: 2, alumni: 1 }));
  };
  const save = databaseSaver("https://abc.supabase.co", KEYS, fakeFetch as typeof fetch);

  const result = await save([], []);

  assertEquals(result, { programmes: 2, alumni: 1 });
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://abc.supabase.co/rest/v1/rpc/apply_sync");
  assertEquals(calls[0].init.method, "POST");
  const headers = new Headers(calls[0].init.headers);
  assertEquals(headers.get("apikey"), "sb_secret_test");
  assertEquals(headers.get("authorization"), null);
  assertEquals(JSON.parse(String(calls[0].init.body)), { new_programmes: [], new_alumni: [] });
});

Deno.test("a refusal by the database is passed on in plain words", async () => {
  const fakeFetch = () =>
    Promise.resolve(Response.json(
      { code: "P0001", message: "Refused: this sync would remove 80 of the 139 programmes.", hint: "Check the sheets." },
      { status: 400 },
    ));
  const save = databaseSaver("https://abc.supabase.co", KEYS, fakeFetch as typeof fetch);
  await assertRejects(() => save([], []), Error, "would remove 80 of the 139 programmes. Check the sheets.");
});

Deno.test("a missing configuration gives a clear error", async () => {
  await assertRejects(() => databaseSaver(undefined, KEYS)([], []), Error, "SUPABASE_URL is missing");
  await assertRejects(() => databaseSaver("https://abc.supabase.co", undefined)([], []), Error, "SUPABASE_SECRET_KEYS");
});

Deno.test("the default secret key is used, or else the first one", () => {
  assertEquals(readSecretKey(JSON.stringify({ other: "sb_secret_other", default: "sb_secret_default" })), "sb_secret_default");
  assertEquals(readSecretKey(JSON.stringify({ other: "sb_secret_other" })), "sb_secret_other");
  assertThrows(() => readSecretKey("{}"), Error, "holds no key");
  assertThrows(() => readSecretKey("not json"), Error, "missing");
});
