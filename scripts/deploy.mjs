// Deploys the database migrations and server functions to one Supabase project.
//
//   npm run deploy:test    deploy to the test project
//   npm run deploy:live    deploy to the live project (asks for confirmation first)
//
// The project refs live in supabase/projects.json. Log in once with `npx supabase login`.
// The Supabase CLI asks for the project's database password when it needs it.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const target = process.argv[2];
const projects = JSON.parse(readFileSync(new URL("../supabase/projects.json", import.meta.url), "utf8"));
const ref = projects[target]?.ref;

if (!["test", "live"].includes(target)) {
  fail('Choose an environment: "npm run deploy:test" or "npm run deploy:live".');
}
if (!ref) {
  fail(`The ${target} project ref is empty. Fill it in in supabase/projects.json first.`);
}

if (target === "live") {
  // The warning goes on its own line: a multi-line prompt gets redrawn twice in narrow terminals.
  console.log(`This deploys to the LIVE project (${ref}) that students use.`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`Has this change been tried on test first? Type "live" to continue: `);
  prompt.close();
  if (answer.trim() !== "live") fail("Stopped. Nothing was deployed.");
}

console.log(`\n1/3  Applying database migrations to ${target} (${ref})`);
supabase("db", "push", `--remote=${ref}`);

console.log(`\n2/3  Deploying server functions to ${target}`);
supabase("functions", "deploy", `--remote=${ref}`, "--use-api");

console.log(`\n3/3  Setting APP_ENV=${target}`);
supabase("secrets", "set", `APP_ENV=${target}`, `--remote=${ref}`);

console.log(`\nDone. ${target} is up to date.`);

function supabase(...args) {
  const result = spawnSync("npx", ["supabase", ...args], { stdio: "inherit" });
  if (result.status !== 0) fail(`"supabase ${args.join(" ")}" failed. Nothing after this step was run.`);
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}
