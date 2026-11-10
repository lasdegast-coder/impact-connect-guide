// Checks that the skill (SKILL.md) names exactly the values the sync accepts, as listed in
// supabase/functions/sync/vocabulary.ts. The skill is saved by hand in claude.ai, so without this
// test the two could drift apart unnoticed, and programmes the skill adds would be left out of
// the guide.
//
// When a test here fails: make the list in SKILL.md match vocabulary.ts, then save the skill in
// claude.ai again (see "The add-programme skill" in README.md).

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  COSTS,
  DEADLINE_STATUSES,
  EXPERIENCE_LEVELS,
  FIELDS,
  LANGUAGES,
  LOCATIONS,
  SOURCE_TABS,
  TYPES,
  WAYS_OF_CONTRIBUTING,
} from "../../supabase/functions/sync/vocabulary.ts";

const SKILL = Deno.readTextFileSync(new URL("./SKILL.md", import.meta.url));

// The bullets of the skill's "The allowed values" section, by their bold label, and the list in
// vocabulary.ts each one must match.
const LISTS: Record<string, readonly string[]> = {
  "Type": TYPES,
  "Fields": FIELDS,
  "Ways of contributing": WAYS_OF_CONTRIBUTING,
  "Costs": COSTS,
  "Language": Object.keys(LANGUAGES),
  "Location": LOCATIONS,
  "Deadline status": DEADLINE_STATUSES,
  "Experience level": EXPERIENCE_LEVELS,
};

// The lines of a section of SKILL.md, from its heading up to the next heading.
function section(heading: string): string[] {
  const lines = SKILL.split("\n");
  const start = lines.indexOf(heading);
  assert(start >= 0, `SKILL.md has no heading "${heading}"`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith("#"));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

// Every value in backticks in a line, sorted, each once. A bullet may name a value twice, as in
// "Usually: Volunteer work → `Volunteering`".
function valuesIn(line: string): string[] {
  return [...new Set([...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]))].sort();
}

Deno.test("the skill's allowed values are exactly the values the sync accepts", () => {
  // Each bullet by its bold label: "- **Type:** `Fellowship / programme`, ..." or
  // "- **Fields** (Main field and Other fields): `Climate & Energy`, ...".
  const listed: Record<string, string[]> = {};
  for (const line of section("### The allowed values")) {
    const label = line.match(/^- \*\*(.+?):?\*\*/)?.[1];
    if (label) listed[label] = valuesIn(line);
  }
  const accepted = Object.fromEntries(Object.entries(LISTS).map(([label, values]) => [label, [...values].sort()]));
  assertEquals(listed, accepted, "SKILL.md (lines starting with -) differs from vocabulary.ts (lines starting with +)");
});

Deno.test("the skill's tab table names exactly the source tabs the sync accepts", () => {
  // "| Volunteer work | Open-ended volunteering, ... | VOL | 562032160 |", after the header row and
  // the |---| row.
  const tabs = section("## Tabs, and which one to pick")
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) => line.split("|")[1].trim());
  assertEquals(
    tabs.sort(),
    [...SOURCE_TABS].sort(),
    "the tabs in SKILL.md (lines starting with -) differ from SOURCE_TABS in vocabulary.ts (lines starting with +)",
  );
});
