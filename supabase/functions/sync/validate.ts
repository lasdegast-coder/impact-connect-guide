// Checks every value the Apps Script sends, before anything is saved.
//
// Two kinds of problems:
// - A problem with the request as a whole (wrong shape, an unknown or forbidden column):
//   checkSyncRequest throws a RequestError and nothing is saved.
// - A problem with one value: that row is left out until the sheet is fixed, and the problem
//   goes into the report. The other rows are saved.
//
// Reports name the sheet, row and column. They quote the wrong value for programmes (public
// information), but never for alumni.

import {
  COSTS,
  DEADLINE_STATUSES,
  EXPERIENCE_LEVELS,
  FIELDS,
  LANGUAGES,
  LOCATIONS,
  MAX_OTHER_FIELDS,
  SOURCE_TABS,
  TYPES,
  WAYS_OF_CONTRIBUTING,
} from "./vocabulary.ts";

export type Problem = {
  where: string; // for example "Catalogue row 12 (IDP-11, Solve Consulting)"
  column: string; // the column header in the sheet
  message: string;
};

// A programme as saved in public.programmes.
export type ProgrammeRow = {
  id: string;
  name: string;
  source_tab: string;
  type: string;
  description: string | null;
  one_liner: string | null;
  url: string | null;
  sign_up: string | null;
  deadline_details: string | null;
  duration: string | null;
  location_details: string | null;
  costs_details: string | null;
  host: string | null;
  main_field: string;
  other_fields: string[];
  topics: string[];
  ways_of_contributing: string[];
  skills: string[];
  experience_level: number;
  hours_per_week: string | null;
  costs: string;
  languages: string[];
  location: string;
  deadline_status: string;
  next_deadline: string | null;
  good_fit_for: string;
};

// An alumnus as saved in public.alumni. `consent` is checked once more by the database.
export type AlumnusRow = {
  responded_at: string;
  consent: true;
  full_name: string;
  bachelor: string | null;
  master: string | null;
  current_occupation: string | null;
  previous_occupation: string | null;
  fields_of_interest: string | null;
  linkedin_url: string | null;
};

export type CheckedSync = {
  received: { programmes: number; alumni: number };
  programmes: ProgrammeRow[];
  alumni: AlumnusRow[];
  problems: Problem[];
};

export class RequestError extends Error {}

// What the Apps Script sends for each programme: the catalogue tags joined with the details
// from the Programmes Database, plus where each came from (for the report).
const PROGRAMME_COLUMNS = {
  // Catalogue sheet
  id: "ID",
  sourceTab: "Source tab",
  type: "Type",
  mainField: "Main field",
  otherFields: "Other fields",
  topics: "Specific topics",
  waysOfContributing: "Ways of contributing",
  skills: "Skills you build",
  experienceLevel: "Experience level",
  hoursPerWeek: "Hours per week",
  costs: "Costs",
  language: "Language",
  location: "Location",
  deadlineStatus: "Deadline status",
  nextDeadline: "Next deadline",
  goodFitFor: "Good fit for",
  // Programmes Database
  name: "Programme Name",
  description: "Description",
  oneLiner: "one-liner",
  url: "URL",
  signUp: "Sign up date",
  deadlineDetails: "Sign-up deadline",
  duration: "Duration",
  locationDetails: "Location",
  costsDetails: "Costs",
  host: "Host university/institution",
} as const;

type ProgrammeKey = keyof typeof PROGRAMME_COLUMNS;

const FROM_PROGRAMMES_DATABASE: ReadonlySet<ProgrammeKey> = new Set([
  "name",
  "description",
  "oneLiner",
  "url",
  "signUp",
  "deadlineDetails",
  "duration",
  "locationDetails",
  "costsDetails",
  "host",
]);

// What the Apps Script sends for each alumnus. Nothing else is accepted: a request with any
// other column (such as a phone number or email address) is refused as a whole.
const ALUMNI_COLUMNS = {
  respondedAt: "Tijdstempel",
  consent: "Do you hereby give us permission...",
  fullName: "Full name",
  bachelor: "BSC",
  master: "MSC",
  currentOccupation: "Current occupation",
  previousOccupation: "Previous occupation",
  fieldsOfInterest: "Fields of interest",
  linkedin: "LinkedIn",
} as const;

type AlumnusKey = keyof typeof ALUMNI_COLUMNS;

const MAX_ROWS = 2000;

// The same two patterns as public.has_contact_details() in the database migration.
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_PATTERN = /(\+|00)?[0-9]([\s().-]*[0-9]){8,}/;

// True when a text contains something that looks like an email address or a phone number
// (at least 9 digits, optionally separated by spaces, dots, dashes or brackets).
export function hasContactDetails(text: string): boolean {
  return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

export function checkSyncRequest(body: unknown): CheckedSync {
  if (!isPlainObject(body)) {
    throw new RequestError("The request must be a JSON object with programmes and alumni.");
  }
  const unknownTopLevel = Object.keys(body).filter((key) => key !== "programmes" && key !== "alumni");
  if (unknownTopLevel.length > 0) {
    throw new RequestError(`Unknown part of the request: ${unknownTopLevel.join(", ")}.`);
  }
  const { programmes, alumni } = body;
  if (!Array.isArray(programmes) || !Array.isArray(alumni)) {
    throw new RequestError("The request must contain a list of programmes and a list of alumni.");
  }
  if (programmes.length === 0) {
    throw new RequestError("No programmes were sent. Nothing was changed.");
  }
  if (programmes.length > MAX_ROWS || alumni.length > MAX_ROWS) {
    throw new RequestError(`At most ${MAX_ROWS} programmes and ${MAX_ROWS} alumni can be sent at once.`);
  }
  programmes.forEach((record, index) => checkShape(record, index, "programme", PROGRAMME_COLUMNS));
  alumni.forEach((record, index) => checkShape(record, index, "alumnus", ALUMNI_COLUMNS));

  const problems: Problem[] = [];
  const checkedProgrammes = leaveOutDuplicates(
    programmes.map((record) => checkProgramme(record as Record<string, unknown>)),
    (row) => row.id,
    (id) => `The ID ${id} is used by more than one row in the Catalogue.`,
    "ID",
  );
  const checkedAlumni = leaveOutDuplicates(
    alumni.map((record) => checkAlumnus(record as Record<string, unknown>)),
    (row) => row.responded_at,
    () => "Another row has exactly the same form timestamp.",
    ALUMNI_COLUMNS.respondedAt,
  );

  const savedProgrammes: ProgrammeRow[] = [];
  for (const checked of checkedProgrammes) {
    if (checked.problems.length > 0) problems.push(...checked.problems);
    else savedProgrammes.push(checked.row);
  }
  const savedAlumni: AlumnusRow[] = [];
  for (const checked of checkedAlumni) {
    if (checked.problems.length > 0) problems.push(...checked.problems);
    else savedAlumni.push(checked.row);
  }

  return {
    received: { programmes: programmes.length, alumni: alumni.length },
    programmes: savedProgrammes,
    alumni: savedAlumni,
    problems,
  };
}

type Checked<Row> = { row: Row; problems: Problem[]; where: string };

function checkProgramme(record: Record<string, unknown>): Checked<ProgrammeRow> {
  const id = text(record.id);
  const name = text(record.name);
  const label = [id, name].filter(Boolean).join(", ");
  const catalogue = `Catalogue row ${record.catalogueRow}` + (label ? ` (${label})` : "");
  const source = `${text(record.sourceTab) || "Programmes Database"} row ${record.sourceRow}` +
    (label ? ` (${label})` : "");

  const problems: Problem[] = [];
  const report = (key: ProgrammeKey, message: string) =>
    problems.push({
      where: FROM_PROGRAMMES_DATABASE.has(key) ? source : catalogue,
      column: PROGRAMME_COLUMNS[key],
      message,
    });

  const required = (key: ProgrammeKey, maxLength: number): string => {
    const value = text(record[key]);
    if (!value) report(key, "is empty.");
    else if (value.length > maxLength) report(key, `is longer than ${maxLength} characters.`);
    return value;
  };
  const optional = (key: ProgrammeKey, maxLength: number): string | null => {
    const value = text(record[key]);
    if (value.length > maxLength) report(key, `is longer than ${maxLength} characters.`);
    return value || null;
  };
  const oneOf = (key: ProgrammeKey, allowed: readonly string[]): string => {
    const value = text(record[key]);
    if (!value) {
      report(key, `is empty. Use one of: ${allowed.join(", ")}.`);
      return "";
    }
    const match = findValue(value, allowed);
    if (!match) report(key, `${quote(value)} is not one of: ${allowed.join(", ")}.`);
    return match ?? "";
  };
  const knownList = (key: ProgrammeKey, allowed: readonly string[]): string[] => {
    const { values, unknown } = parseKnownList(text(record[key]), allowed);
    for (const part of unknown) report(key, `${quote(part)} is not one of: ${allowed.join(", ")}.`);
    return values;
  };
  const freeList = (key: ProgrammeKey): string[] => {
    const values = unique(splitList(text(record[key])));
    for (const value of values) {
      if (value.length > 80) report(key, `${quote(value)} is longer than 80 characters. Separate items with commas.`);
    }
    return values;
  };

  if (id && !/^[A-Z]+-[0-9]+$/.test(id)) report("id", `${quote(id)} should look like IDP-01.`);
  required("id", 20);
  required("name", 200);
  const sourceTab = oneOf("sourceTab", SOURCE_TABS);
  const type = oneOf("type", TYPES);

  const mainField = oneOf("mainField", FIELDS);
  const otherFields = knownList("otherFields", FIELDS).filter((field) => field !== mainField);
  if (otherFields.length > MAX_OTHER_FIELDS) {
    report("otherFields", `has ${otherFields.length} fields; use at most ${MAX_OTHER_FIELDS}.`);
  }
  const topics = freeList("topics");
  if (topics.length === 0) report("topics", "is empty.");
  const waysOfContributing = knownList("waysOfContributing", WAYS_OF_CONTRIBUTING);
  if (waysOfContributing.length === 0 && text(record.waysOfContributing) === "") {
    report("waysOfContributing", "is empty.");
  }
  const skills = freeList("skills");

  const experienceLevel = oneOf("experienceLevel", EXPERIENCE_LEVELS);
  const costs = oneOf("costs", COSTS);
  const language = oneOf("language", Object.keys(LANGUAGES));
  const location = oneOf("location", LOCATIONS);
  const deadlineStatus = oneOf("deadlineStatus", DEADLINE_STATUSES);

  const nextDeadline = text(record.nextDeadline);
  if (nextDeadline && !isDate(nextDeadline)) {
    report("nextDeadline", `${quote(nextDeadline)} is not a date written as YYYY-MM-DD, like 2026-11-16.`);
  }

  const url = text(record.url);
  if (url) {
    const problem = urlProblem(url);
    if (problem) report("url", `${quote(url)} ${problem}`);
  }

  const row: ProgrammeRow = {
    id,
    name: text(record.name),
    source_tab: sourceTab,
    type,
    description: optional("description", 5000),
    one_liner: optional("oneLiner", 1000),
    url: url || null,
    sign_up: optional("signUp", 1000),
    deadline_details: optional("deadlineDetails", 1000),
    duration: optional("duration", 1000),
    location_details: optional("locationDetails", 1000),
    costs_details: optional("costsDetails", 1000),
    host: optional("host", 1000),
    main_field: mainField,
    other_fields: otherFields,
    topics,
    ways_of_contributing: waysOfContributing,
    skills,
    experience_level: Number(experienceLevel),
    hours_per_week: optional("hoursPerWeek", 200),
    costs,
    languages: LANGUAGES[language] ?? [],
    location,
    deadline_status: deadlineStatus,
    next_deadline: nextDeadline || null,
    good_fit_for: required("goodFitFor", 1000),
  };
  return { row, problems, where: catalogue };
}

function checkAlumnus(record: Record<string, unknown>): Checked<AlumnusRow> {
  const where = `Alumni row ${record.row}`;
  const problems: Problem[] = [];
  const report = (key: AlumnusKey, message: string) =>
    problems.push({ where, column: ALUMNI_COLUMNS[key], message });

  // Personal text: dashes count as empty, contact details are refused, values are never quoted.
  const personal = (key: AlumnusKey, maxLength: number): string | null => {
    const value = text(record[key]).replace(/^[-–—]+$/, "");
    if (value.length > maxLength) report(key, `is longer than ${maxLength} characters.`);
    if (hasContactDetails(value)) {
      report(key, "looks like it contains an email address or phone number. Remove it from the sheet.");
    }
    return value || null;
  };

  if (record.consent !== true) report("consent", "has no permission, so this alumnus is not saved.");

  const respondedAt = text(record.respondedAt);
  const respondedDate = new Date(respondedAt);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(respondedAt) || Number.isNaN(respondedDate.getTime())) {
    report("respondedAt", "is missing or is not a date and time.");
  }

  const fullName = personal("fullName", 200);
  if (!fullName) report("fullName", "is empty.");

  const linkedin = text(record.linkedin);
  let linkedinUrl: string | null = null;
  if (linkedin) {
    linkedinUrl = normaliseLinkedIn(linkedin);
    if (!linkedinUrl) report("linkedin", "is not a link to a LinkedIn profile.");
  }

  const row: AlumnusRow = {
    responded_at: Number.isNaN(respondedDate.getTime()) ? "" : respondedDate.toISOString(),
    consent: true,
    full_name: fullName ?? "",
    bachelor: personal("bachelor", 300),
    master: personal("master", 300),
    current_occupation: personal("currentOccupation", 300),
    previous_occupation: personal("previousOccupation", 300),
    fields_of_interest: personal("fieldsOfInterest", 2000),
    linkedin_url: linkedinUrl,
  };
  return { row, problems, where };
}

// Leaves out every row whose key (ID or form timestamp) appears more than once.
function leaveOutDuplicates<Row>(
  checked: Checked<Row>[],
  keyOf: (row: Row) => string,
  message: (key: string) => string,
  column: string,
): Checked<Row>[] {
  const counts = new Map<string, number>();
  for (const { row } of checked) {
    const key = keyOf(row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return checked.map((item) => {
    const key = keyOf(item.row);
    if ((counts.get(key) ?? 0) < 2) return item;
    return { ...item, problems: [...item.problems, { where: item.where, column, message: message(key) }] };
  });
}

// The request must have the shape the Apps Script sends. Any other column is refused.
function checkShape(
  record: unknown,
  index: number,
  kind: "programme" | "alumnus",
  columns: Record<string, string>,
) {
  const position = `${kind} number ${index + 1}`;
  if (!isPlainObject(record)) throw new RequestError(`The ${position} is not an object.`);

  const rowKeys = kind === "programme" ? ["catalogueRow", "sourceRow"] : ["row"];
  for (const key of Object.keys(record)) {
    if (rowKeys.includes(key)) continue;
    if (!(key in columns)) {
      const contact = /phone|mail|tel|contact/i.test(key) ? " Contact details are never accepted." : "";
      throw new RequestError(`The ${position} has an unknown column "${key}". Nothing was changed.${contact}`);
    }
    const value = record[key];
    const expected = key === "consent" ? typeof value === "boolean" : typeof value === "string";
    if (!expected) throw new RequestError(`The ${position} has a wrong type for "${key}".`);
  }
  for (const key of rowKeys) {
    if (!Number.isInteger(record[key]) || (record[key] as number) < 1) {
      throw new RequestError(`The ${position} has no valid sheet row number ("${key}").`);
    }
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findValue(value: string, allowed: readonly string[]): string | undefined {
  return allowed.find((candidate) => normalise(candidate) === normalise(value));
}

function splitList(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// Splits a comma-separated list of known values. A value may itself contain a comma
// ("Education, Activism & Engagement"), so neighbouring parts are tried together first.
function parseKnownList(value: string, allowed: readonly string[]): { values: string[]; unknown: string[] } {
  const parts = splitList(value);
  const values: string[] = [];
  const unknown: string[] = [];
  let index = 0;
  while (index < parts.length) {
    const pair = index + 1 < parts.length ? findValue(`${parts[index]}, ${parts[index + 1]}`, allowed) : undefined;
    if (pair) {
      values.push(pair);
      index += 2;
      continue;
    }
    const single = findValue(parts[index], allowed);
    if (single) values.push(single);
    else unknown.push(parts[index]);
    index += 1;
  }
  return { values: unique(values), unknown };
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function urlProblem(value: string): string | null {
  if (/\s/.test(value)) return "should be one web address without spaces or other text, or an empty cell.";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "should start with https://";
    if (!url.hostname.includes(".")) return "is not a complete web address.";
    return null;
  } catch {
    return "is not a web address. It should start with https://";
  }
}

// Returns a clean https://…linkedin.com/… address without tracking parts, or null.
function normaliseLinkedIn(value: string): string | null {
  if (/\s/.test(value)) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname;
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;
    if (url.username || url.password) return null;
    return `https://${host}${url.pathname}`;
  } catch {
    return null;
  }
}

function quote(value: string): string {
  const short = value.length > 80 ? `${value.slice(0, 77)}...` : value;
  return `"${short.replace(/\n/g, " ")}"`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
