import { assertEquals } from "jsr:@std/assert@1";
import { handleHealth } from "./handler.ts";

Deno.test("health reports ok and the environment", async () => {
  const response = handleHealth(new Request("http://localhost/health"), "test");
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true, environment: "test" });
});

Deno.test("health falls back to an unknown environment", async () => {
  const response = handleHealth(new Request("http://localhost/health"), undefined);
  assertEquals(await response.json(), { ok: true, environment: "unknown" });
});

Deno.test("health answers the browser's CORS preflight", () => {
  const response = handleHealth(new Request("http://localhost/health", { method: "OPTIONS" }), "test");
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});
