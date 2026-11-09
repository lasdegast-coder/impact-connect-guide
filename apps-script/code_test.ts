// Runs the Apps Script (Code.js) against made-up sheets, with small stand-ins for Google's
// services, to check what it reads and what it sends. No real data is used.

import { assert, assertEquals, assertFalse, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";

const CODE = Deno.readTextFileSync(new URL("./Code.js", import.meta.url));
const SECRET = "a-test-secret-that-is-long-enough-1234567890";
const TEST_URL = "https://pamkxxyinunskokuquzv.supabase.co/functions/v1/sync";
const LIVE_URL = "https://utmgdneedxrohyvqhdzy.supabase.co/functions/v1/sync";

// A cell is its text, a date value, or a value that the sheet shows as different text.
type Shown = { value: Date; shown: string };
type Cell = string | Date | Shown;

const isShown = (cell: Cell): cell is Shown => typeof cell === "object" && "shown" in cell;

// ---- Made-up sheets ----------------------------------------------------------------------

const BASIC_HEADERS = [
  "Programme Name", "Description", "Sign up date", "Duration ", "Language", "Experience level",
  "URL ", "Location ", "Costs ", "Partner (yes/no)",
];
const IMPACT_HEADERS = [
  "Programme Name", "Description", "Sign up date", "Duration ", "Language", "Experience level", "URL ",
  "Location ", "Costs ", "Interest ", "one-liner ", "Partner (yes/no)", "Sign-up deadline", "other notes ",
];
const SUMMER_HEADERS = [
  "Programme Name", "Host university/institution", "Description", "Sign up date /moment", "Duration",
  "Language", "Experience level", "URL", "Location", "Costs", "Specific field of interest", "Partner (yes/no)",
];
const CATALOGUE_HEADERS = [
  "ID", "Programme name", "Source tab", "Type", "Main field", "Other fields", "Specific topics",
  "Ways of contributing", "Skills you build", "Experience level", "Hours per week", "Costs", "Language",
  "Location", "Deadline status", "Next deadline", "Good fit for", "Data to check",
];
const ALUMNI_HEADERS = [
  "Tijdstempel", "Full name ", "BSC", "MSC", "Current occupation ", "Previous occupation", "Fields of interest ",
  "Do you hereby give us permission to be contact by a student for a career related question? ",
  "I prefer to be contact by ", "Phone number", "Email ", "LinkedIn", "Prefered frequency of contact",
];
const ALUMNI_CONTACT_COLUMNS = [9, 10, 11, 13]; // preference, phone, email, frequency (1 = column A)

function catalogueRow(id: string, name: string, tab: string, changes: Partial<Record<string, Cell>> = {}): Cell[] {
  const row: Record<string, Cell> = {
    "ID": id, "Programme name": name, "Source tab": tab, "Type": "Fellowship / programme",
    "Main field": "Nature & Biodiversity", "Other fields": "", "Specific topics": "conservation, gis",
    "Ways of contributing": "Research & Analysis", "Skills you build": "gis", "Experience level": "1",
    "Hours per week": "10-15", "Costs": "Free", "Language": "English", "Location": "Online",
    "Deadline status": "Rolling", "Next deadline": "", "Good fit for": "Students who like testing.",
    "Data to check": "Internal note",
    ...changes,
  };
  return CATALOGUE_HEADERS.map((header) => row[header]);
}

function alumniRow(when: string, name: string, permission: string, phone: string, email: string): Cell[] {
  return [
    new Date(when), name, "Future Planet Studies", "Sustainable Development", "Policy advisor", "", "Energy",
    permission, "Email", phone, email, "https://www.linkedin.com/in/test", "Once a month",
  ];
}

function makeSheets() {
  return {
    programmes: {
      "Volunteer work": [BASIC_HEADERS],
      "Youth Organizations": [BASIC_HEADERS],
      "Impact Driven Programmes": [
        IMPACT_HEADERS,
        [
          "Test Externship", "An online externship.", "3 cohorts per year", "6 to 12 weeks", "English", "1",
          "https://www.example.org/externships", "International (online)", "Not paid", "ecology",
          "Explore conservation online.", "no", "Not announced", "Contact: someone@example.org",
        ],
        [], // an empty row in the middle
        ["Nationale Test Training", "Ten weeks of training.", "", "10 weeks", "Dutch", "1", "", "Nederland", "", "", "", "no", "", ""],
        ["Unlisted Programme", "Not in the catalogue yet.", "", "", "", "", "", "", "", "", "", "no", "", ""],
      ],
      "Paid Impact Programmes": [IMPACT_HEADERS.slice(0, 13)],
      "Summer School Programmes": [
        SUMMER_HEADERS,
        [
          "Test Summer School", "Test University", "Two weeks of GIS.", "Applications open in winter", "2 weeks",
          "English", "3", "https://www.example.org/summer", "Utrecht, NL", "EUR 660", "Geospatial", "no",
        ],
      ],
      "Programs from other university": [
        BASIC_HEADERS,
        ["Nationale Test Training", "The same name in another tab.", "", "", "Dutch", "1", "https://www.example.org/nwt", "Netherlands", "", "no"],
      ],
    } as Record<string, Cell[][]>,
    catalogue: [
      CATALOGUE_HEADERS,
      catalogueRow("IDP-01", "test   externship", "Impact Driven Programmes"),
      catalogueRow("SUM-01", "Test Summer School", "Summer School Programmes", {
        // A date cell. The sheet shows 2027-03-12, but its value is midnight in Amsterdam,
        // which is still the previous day in UTC: only the shown text is reliable.
        "Next deadline": { value: new Date("2027-03-11T23:00:00Z"), shown: "2027-03-12" },
        "Deadline status": "Open",
      }),
      catalogueRow("IDP-02", "Nationale Test Training", "Impact Driven Programmes"),
      catalogueRow("UNI-01", "Nationale Test Training", "Programs from other university"),
      catalogueRow("IDP-03", "Missing Programme", "Impact Driven Programmes"),
      catalogueRow("XXX-01", "Test Externship", "Old tab"),
      [],
    ],
    alumni: [
      ALUMNI_HEADERS,
      alumniRow("2026-09-02T09:27:44Z", "Test Alumna", "Yes, I give permission", "0612345678", "test.alumna@example.org"),
      alumniRow("2026-09-03T10:00:00Z", "Test Without Permission", "No", "0698765432", "no.permission@example.org"),
      alumniRow("2026-09-04T11:00:00Z", "Test Alumnus", "Yes, I give permission", "+31 6 11112222", "test.alumnus@example.org"),
      // The same person filled in the form again and now says no.
      alumniRow("2026-10-01T12:00:00Z", "test alumnus", "No", "+31 6 11112222", "test.alumnus@example.org"),
      [],
    ],
  };
}

// The same sheets without the rows that cause problems.
function sheetsWithoutProblems() {
  const sheets = makeSheets();
  sheets.catalogue = sheets.catalogue.slice(0, 5);
  sheets.programmes["Impact Driven Programmes"] = sheets.programmes["Impact Driven Programmes"].slice(0, 4);
  sheets.alumni = sheets.alumni.slice(0, 3);
  return sheets;
}

// ---- Stand-ins for Google's services -----------------------------------------------------

class FakeSheet {
  dataColumnsRead: number[] = [];
  constructor(private grid: Cell[][]) {}
  getLastRow() {
    let last = this.grid.length;
    while (last > 0 && this.grid[last - 1].every((cell) => cell === "")) last--;
    return last;
  }
  getLastColumn() {
    return Math.max(0, ...this.grid.map((row) => row.length));
  }
  getRange(row: number, column: number, rows: number, columns: number) {
    const cells: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      const line: Cell[] = [];
      for (let c = 0; c < columns; c++) line.push(this.grid[row - 1 + r]?.[column - 1 + c] ?? "");
      cells.push(line);
    }
    if (row > 1) for (let c = 0; c < columns; c++) this.dataColumnsRead.push(column + c);
    return {
      getValues: () => cells.map((line) => line.map((cell) => (isShown(cell) ? cell.value : cell))),
      getDisplayValues: () =>
        cells.map((line) => line.map((cell) => (isShown(cell) ? cell.shown : cell instanceof Date ? cell.toString() : String(cell)))),
    };
  }
}

function fakeFile(name: string, tabs: Record<string, Cell[][]>) {
  const sheets = Object.fromEntries(Object.entries(tabs).map(([tab, grid]) => [tab, new FakeSheet(grid)]));
  return {
    sheets,
    getName: () => name,
    getSheetByName: (tab: string) => sheets[tab] ?? null,
  };
}

function formatDate(date: Date, timeZone: string, pattern: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return pattern.replace("yyyy", parts.year).replace("MM", parts.month).replace("dd", parts.day)
    .replace("HH", parts.hour).replace("mm", parts.minute);
}

type Answer = (payload: { programmes: unknown[]; alumni: unknown[] }) => { status: number; body: unknown };

function okAnswer(payload: { programmes: unknown[]; alumni: unknown[] }) {
  return {
    status: 200,
    body: {
      ok: true,
      environment: "test",
      received: { programmes: payload.programmes.length, alumni: payload.alumni.length },
      saved: { programmes: payload.programmes.length, alumni: payload.alumni.length },
      leftOut: { programmes: 0, alumni: 0 },
      problems: [],
    },
  };
}

function setup(options: { properties?: Record<string, string>; sheets?: ReturnType<typeof makeSheets>; answer?: Answer } = {}) {
  const sheets = options.sheets ?? makeSheets();
  const files = {
    "1jIjZ15sPo5i6OIOW4dlv1kAlTT-2qObawFDdMUF4Ejc": fakeFile("Programmes Database", sheets.programmes),
    "162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY": fakeFile("Catalogue", { Catalogue: sheets.catalogue }),
    "1bMsC5tPuzI195xlvU2UIm-ITMMsHyFR_bVTGqdmE3-Q": fakeFile("Alumni", { "Formulierreacties 1": sheets.alumni }),
  } as Record<string, ReturnType<typeof fakeFile>>;
  const properties = new Map(Object.entries(options.properties ?? { SYNC_SECRET_TEST: SECRET }));
  const requests: { url: string; options: { headers: Record<string, string>; payload: string } }[] = [];
  const emails: { to: string; subject: string; body: string }[] = [];
  const logs: string[] = [];
  const triggers: { handler: string }[] = [];
  const answer = options.answer ?? okAnswer;

  const globals: Record<string, unknown> = {
    SpreadsheetApp: { openById: (id: string) => files[id] },
    UrlFetchApp: {
      fetch: (url: string, fetchOptions: { headers: Record<string, string>; payload: string }) => {
        requests.push({ url, options: fetchOptions });
        const { status, body } = answer(JSON.parse(fetchOptions.payload));
        return { getResponseCode: () => status, getContentText: () => JSON.stringify(body) };
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
        deleteProperty: (key: string) => properties.delete(key),
      }),
    },
    Utilities: { formatDate },
    Session: {
      getScriptTimeZone: () => "Europe/Amsterdam",
      getEffectiveUser: () => ({ getEmail: () => "owner@example.org" }),
    },
    MailApp: { sendEmail: (to: string, subject: string, body: string) => emails.push({ to, subject, body }) },
    ScriptApp: {
      newTrigger: (handler: string) => ({
        timeBased: () => ({ everyHours: () => ({ create: () => triggers.push({ handler }) }) }),
      }),
      getProjectTriggers: () => triggers.map((trigger) => ({ getHandlerFunction: () => trigger.handler, trigger })),
      deleteTrigger: (wrapped: { trigger: { handler: string } }) => triggers.splice(triggers.indexOf(wrapped.trigger), 1),
    },
    console: { log: (message: string) => logs.push(message) },
  };
  const names = Object.keys(globals);
  const script = new Function(
    ...names,
    `${CODE}\nreturn { syncNow, syncOnSchedule, startHourlySync, stopHourlySync, selectAlumni_ };`,
  )(...names.map((name) => globals[name]));

  const sent = () => JSON.parse(requests[0].options.payload);
  return { script, files, properties, requests, emails, logs, triggers, sent };
}

// ---- Tests -------------------------------------------------------------------------------

Deno.test("programmes are joined with their catalogue tags on tab and name", () => {
  const { script, sent, requests } = setup();
  script.syncNow();

  assertEquals(requests.length, 1);
  assertEquals(requests[0].url, TEST_URL);
  assertEquals(requests[0].options.headers, { "x-sync-secret": SECRET });

  const programmes = sent().programmes;
  assertEquals(programmes.map((p: { id: string }) => p.id), ["IDP-01", "SUM-01", "IDP-02", "UNI-01"]);
  assertEquals(programmes[0], {
    catalogueRow: 2,
    sourceRow: 2,
    id: "IDP-01",
    sourceTab: "Impact Driven Programmes",
    type: "Fellowship / programme",
    mainField: "Nature & Biodiversity",
    otherFields: "",
    topics: "conservation, gis",
    waysOfContributing: "Research & Analysis",
    skills: "gis",
    experienceLevel: "1",
    hoursPerWeek: "10-15",
    costs: "Free",
    language: "English",
    location: "Online",
    deadlineStatus: "Rolling",
    nextDeadline: "",
    goodFitFor: "Students who like testing.",
    name: "Test Externship",
    description: "An online externship.",
    oneLiner: "Explore conservation online.",
    url: "https://www.example.org/externships",
    signUp: "3 cohorts per year",
    deadlineDetails: "Not announced",
    duration: "6 to 12 weeks",
    locationDetails: "International (online)",
    costsDetails: "Not paid",
    host: "",
  });
  // The summer school's own column names, and a date sent exactly as the sheet shows it.
  assertEquals(programmes[1].host, "Test University");
  assertEquals(programmes[1].signUp, "Applications open in winter");
  assertEquals(programmes[1].nextDeadline, "2027-03-12");
  // The same name in two tabs gives two programmes, each with its own details.
  assertEquals(programmes[2].description, "Ten weeks of training.");
  assertEquals(programmes[3].description, "The same name in another tab.");
});

Deno.test("internal columns are never sent", () => {
  const { script, requests } = setup();
  script.syncNow();
  const payload = requests[0].options.payload;
  for (const internal of ["Contact: someone@example.org", "Internal note", "ecology"]) {
    assertFalse(payload.includes(internal), internal);
  }
});

Deno.test("join problems are reported", () => {
  const { script, logs } = setup();
  script.syncNow();
  const report = logs.join("\n");
  assertStringIncludes(report, 'Catalogue row 6 (IDP-03, Missing Programme), Programme name: was not found in the tab "Impact Driven Programmes"');
  assertStringIncludes(report, 'Catalogue row 7 (XXX-01, Test Externship), Source tab: "Old tab" is not one of the tabs');
  assertStringIncludes(report, "Impact Driven Programmes row 5 (Unlisted Programme), Programme Name: has no row in the Catalogue yet");
  assertStringIncludes(report, "Read 6 catalogue rows, 5 programmes and 4 alumni form responses.");
});

Deno.test("only alumni with permission are sent, and only someone's newest response counts", () => {
  const { script, sent, logs } = setup();
  script.syncNow();
  assertEquals(sent().alumni, [{
    row: 2,
    respondedAt: "2026-09-02T09:27:44.000Z",
    consent: true,
    fullName: "Test Alumna",
    bachelor: "Future Planet Studies",
    master: "Sustainable Development",
    currentOccupation: "Policy advisor",
    previousOccupation: "",
    fieldsOfInterest: "Energy",
    linkedin: "https://www.linkedin.com/in/test",
  }]);
  assertStringIncludes(logs.join("\n"), "Alumni rows 4, 5, Full name: look like the same person. Only the newest response (row 5) is used.");
});

Deno.test("the phone, email and contact preference columns are never read or sent", () => {
  const { script, files, requests } = setup();
  script.syncNow();
  const alumniSheet = files["1bMsC5tPuzI195xlvU2UIm-ITMMsHyFR_bVTGqdmE3-Q"].sheets["Formulierreacties 1"];
  assert(alumniSheet.dataColumnsRead.length > 0);
  for (const column of ALUMNI_CONTACT_COLUMNS) {
    assertFalse(alumniSheet.dataColumnsRead.includes(column), `column ${column} was read`);
  }
  const payload = requests[0].options.payload;
  for (const contact of ["0612345678", "0698765432", "+31 6 11112222", "@example.org", "Once a month"]) {
    assertFalse(payload.includes(contact), contact);
  }
});

Deno.test("permission counts only for the exact answer", () => {
  const { script } = setup();
  const row = (rowNumber: number, permission: string) => ({
    rowNumber, respondedAt: new Date("2026-09-02T09:27:44Z"), fullName: `Person ${rowNumber}`, bachelor: "",
    master: "", currentOccupation: "", previousOccupation: "", fieldsOfInterest: "", permission, linkedin: "",
  });
  const result = script.selectAlumni_([
    row(2, "Yes, I give permission"),
    row(3, "  yes,  I give permission "),
    row(4, "Yes"),
    row(5, "No"),
    row(6, ""),
    row(7, "Yes, I give permission!"),
  ]);
  assertEquals(result.records.map((record: { row: number }) => record.row), [2, 3]);
});

Deno.test("an alumnus with permission but without a form timestamp is not sent", () => {
  const { script } = setup();
  const result = script.selectAlumni_([{
    rowNumber: 2, respondedAt: "", fullName: "Typed In By Hand", bachelor: "", master: "",
    currentOccupation: "", previousOccupation: "", fieldsOfInterest: "", permission: "Yes, I give permission", linkedin: "",
  }]);
  assertEquals(result.records, []);
  assertStringIncludes(result.problems[0].message, "not a date");
});

Deno.test("a renamed column stops the sync before anything is sent", () => {
  const sheets = makeSheets();
  sheets.alumni[0] = ALUMNI_HEADERS.map((header) => (header === "LinkedIn" ? "LinkedIn profile" : header));
  const { script, requests } = setup({ sheets });
  const error = assertThrows(() => script.syncNow());
  assertStringIncludes((error as Error).message, 'The tab "Formulierreacties 1" has no column "LinkedIn"');
  assertEquals(requests, []);
});

Deno.test("nothing is sent without a long enough secret", () => {
  const none = setup({ properties: {} });
  assertStringIncludes((assertThrows(() => none.script.syncNow()) as Error).message, "No sync secret found");
  const short = setup({ properties: { SYNC_SECRET_TEST: "short" } });
  assertStringIncludes((assertThrows(() => short.script.syncNow()) as Error).message, "shorter than 32");
  assertEquals([...none.requests, ...short.requests], []);
});

Deno.test("each environment with a secret gets the data", () => {
  const { script, requests } = setup({ properties: { SYNC_SECRET_TEST: SECRET, SYNC_SECRET_LIVE: `${SECRET}-live` } });
  script.syncNow();
  assertEquals(requests.map((request) => request.url), [TEST_URL, LIVE_URL]);
  assertEquals(requests[1].options.headers, { "x-sync-secret": `${SECRET}-live` });
});

Deno.test("the report lists the guide's problems once, and a failure makes the run fail", () => {
  const problem = { where: "Catalogue row 2 (IDP-01, Test Externship)", column: "Costs", message: '"Gratis" is not allowed.' };
  const withProblem = setup({
    properties: { SYNC_SECRET_TEST: SECRET, SYNC_SECRET_LIVE: SECRET },
    answer: (payload) => {
      const answer = okAnswer(payload);
      return { ...answer, body: { ...answer.body, problems: [problem] } };
    },
  });
  withProblem.script.syncNow();
  const report = withProblem.logs.join("\n");
  assertEquals(report.split('"Gratis" is not allowed.').length - 1, 1);
  assertStringIncludes(report, "test: saved 4 programmes and 1 alumni");

  const failing = setup({ answer: () => ({ status: 500, body: { ok: false, error: "Saving failed, so nothing was changed." } }) });
  assertThrows(() => failing.script.syncNow(), Error, "The sync failed");
  assertStringIncludes(failing.logs.join("\n"), "test: FAILED. Saving failed, so nothing was changed.");
});

Deno.test("the hourly sync emails new problems once, and again only when they change", () => {
  const first = { where: "Catalogue row 2 (IDP-01, Test Externship)", column: "Costs", message: '"Gratis" is not allowed.' };
  const second = { where: "Alumni row 2", column: "LinkedIn", message: "is not a link to a LinkedIn profile." };
  let guideProblems: unknown[] = [];
  const { script, emails, properties } = setup({
    sheets: sheetsWithoutProblems(),
    answer: (payload) => {
      const answer = okAnswer(payload);
      return { ...answer, body: { ...answer.body, problems: guideProblems } };
    },
  });

  script.syncOnSchedule();
  assertEquals(emails.length, 0, "no problems, no email");

  guideProblems = [first];
  script.syncOnSchedule();
  script.syncOnSchedule();
  assertEquals(emails.length, 1, "a new problem is emailed once");
  assertEquals(emails[0].to, "owner@example.org");
  assertEquals(emails[0].subject, "Impact Connect sync: 1 problems to fix");
  assertStringIncludes(emails[0].body, '"Gratis" is not allowed.');

  guideProblems = [first, second];
  script.syncOnSchedule();
  assertEquals(emails.length, 2, "a changed list is emailed again");

  guideProblems = [];
  script.syncOnSchedule();
  assertEquals(emails.length, 2);
  assertEquals(properties.get("LAST_EMAILED_REPORT"), undefined, "a problem that comes back is emailed again");
});

Deno.test("a scheduled run that cannot read the sheets sends an email instead of failing silently", () => {
  const sheets = makeSheets();
  delete sheets.programmes["Volunteer work"];
  const { script, emails, requests } = setup({ sheets });
  script.syncOnSchedule();
  assertEquals(requests, []);
  assertEquals(emails.length, 1);
  assertEquals(emails[0].subject, "Impact Connect sync failed");
  assertStringIncludes(emails[0].body, 'The tab "Volunteer work" was not found');
});

Deno.test("startHourlySync keeps exactly one hourly trigger", () => {
  const { script, triggers } = setup();
  script.startHourlySync();
  script.startHourlySync();
  assertEquals(triggers, [{ handler: "syncOnSchedule" }]);
  script.stopHourlySync();
  assertEquals(triggers, []);
});

Deno.test("the script never changes the sheets", () => {
  const writes = /\.(setValues?|setFormulas?|appendRow|insertRows?|insertSheet|deleteRows?|deleteSheet|clear\w*|setName)\(/;
  assertFalse(writes.test(CODE), "Code.js may only read from the sheets");
});
