import { assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";
import { handleSync, type SaveRows } from "./handler.ts";
import type { AlumnusRow, ProgrammeRow } from "./validate.ts";
import { alumnus, programme } from "./test_data.ts";

const SECRET = "a-test-secret-that-is-long-enough-1234567890";

type Saved = { programmes: ProgrammeRow[]; alumni: AlumnusRow[] };

function setup(options: { secret?: string; save?: SaveRows } = {}) {
  const saved: Saved[] = [];
  const save: SaveRows = options.save ?? ((programmes, alumni) => {
    saved.push({ programmes, alumni });
    return Promise.resolve({ programmes: programmes.length, alumni: alumni.length });
  });
  const send = (body: unknown, headers: Record<string, string> = { "x-sync-secret": SECRET }) =>
    handleSync(
      new Request("http://localhost/sync", {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { environment: "test", syncSecret: "secret" in options ? options.secret : SECRET, save },
    );
  return { saved, send };
}

Deno.test("only POST is accepted", async () => {
  const response = await handleSync(new Request("http://localhost/sync"), {
    environment: "test",
    syncSecret: SECRET,
    save: () => Promise.reject(new Error("not called")),
  });
  assertEquals(response.status, 405);
});

Deno.test("without a SYNC_SECRET of at least 32 characters, nothing is accepted", async () => {
  for (const secret of [undefined, "", "too-short"]) {
    const { saved, send } = setup({ secret });
    const response = await send({ programmes: [programme()], alumni: [] }, { "x-sync-secret": secret ?? "" });
    assertEquals(response.status, 500);
    assertStringIncludes((await response.json()).error, "SYNC_SECRET");
    assertEquals(saved, []);
  }
});

Deno.test("a missing or wrong secret is refused", async () => {
  const attempts: Record<string, string>[] = [{}, { "x-sync-secret": "wrong" }, { "x-sync-secret": `${SECRET}x` }];
  for (const headers of attempts) {
    const { saved, send } = setup();
    const response = await send({ programmes: [programme()], alumni: [] }, headers);
    assertEquals(response.status, 401);
    assertEquals(saved, []);
  }
});

Deno.test("a request that is not JSON is refused", async () => {
  const { saved, send } = setup();
  const response = await send("not json");
  assertEquals(response.status, 400);
  assertEquals(saved, []);
});

Deno.test("a request with contact details is refused and nothing is saved", async () => {
  const { saved, send } = setup();
  const response = await send({ programmes: [programme()], alumni: [alumnus({ "Phone number": "0612345678" })] });
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.ok, false);
  assertStringIncludes(body.error, "Contact details are never accepted");
  assertFalse(JSON.stringify(body).includes("0612345678"));
  assertEquals(saved, []);
});

Deno.test("correct rows are saved and the report has no problems", async () => {
  const { saved, send } = setup();
  const response = await send({
    programmes: [programme(), programme({ id: "IDP-02", catalogueRow: 3, name: "Second" })],
    alumni: [alumnus()],
  });
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    environment: "test",
    received: { programmes: 2, alumni: 1 },
    saved: { programmes: 2, alumni: 1 },
    leftOut: { programmes: 0, alumni: 0 },
    problems: [],
    notes: [],
  });
  assertEquals(saved.length, 1);
  assertEquals(saved[0].programmes.map((row) => row.id), ["IDP-01", "IDP-02"]);
  assertEquals(saved[0].alumni.map((row) => row.full_name), ["Test Alumna"]);
});

Deno.test("rows with problems are left out and reported; the others are saved", async () => {
  const { saved, send } = setup();
  const response = await send({
    programmes: [programme(), programme({ id: "IDP-02", catalogueRow: 3, location: "Mars" })],
    alumni: [alumnus(), alumnus({ row: 3, respondedAt: "2026-09-03T10:00:00.000Z", consent: false })],
  });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.leftOut, { programmes: 1, alumni: 1 });
  assertEquals(body.problems.map((problem: { where: string }) => problem.where), [
    "Catalogue row 3 (IDP-02, Test Externship)",
    "Alumni row 3",
  ]);
  assertEquals(saved[0].programmes.map((row) => row.id), ["IDP-01"]);
  assertEquals(saved[0].alumni.length, 1);
});

Deno.test("an alumnus with a wrong LinkedIn cell is saved without the link, with a note", async () => {
  const { saved, send } = setup();
  const response = await send({ programmes: [programme()], alumni: [alumnus({ linkedin: "see my profile" })] });
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.leftOut, { programmes: 0, alumni: 0 });
  assertEquals(body.problems, []);
  assertEquals(body.notes.map((note: { where: string; column: string }) => `${note.where}, ${note.column}`), [
    "Alumni row 2, LinkedIn",
  ]);
  assertFalse(JSON.stringify(body).includes("see my profile"));
  assertEquals(saved[0].alumni[0].linkedin_url, null);
});

Deno.test("when saving fails, the answer says so and still lists the problems", async () => {
  const { send } = setup({
    save: () => Promise.reject(new Error("Refused: this sync would remove 80 of the 139 programmes.")),
  });
  const response = await send({ programmes: [programme(), programme({ id: "X", catalogueRow: 3 })], alumni: [] });
  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.ok, false);
  assertStringIncludes(body.error, "nothing was changed");
  assertStringIncludes(body.error, "would remove 80 of the 139 programmes");
  assertEquals(body.problems.length, 1);
});
