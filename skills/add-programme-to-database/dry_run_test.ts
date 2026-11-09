// Dry run for the "add programme to database" skill (9 November 2026).
//
// The skill adds two rows for a new programme: one in the Programmes Database and one in the
// Catalogue. This test runs the repository's own sync code on those rows, next to the 139
// programmes that are in the sheets today (their real IDs, names and tabs):
// - the Apps Script's join (apps-script/Code.js), and
// - the sync function's checks (supabase/functions/sync/handler.ts and validate.ts).
// The sheets are stand-ins, as in apps-script/code_test.ts: no real sheet is read or written,
// nothing is sent anywhere, and the database is a stand-in too.
//
// The new rows below (NEW_PROGRAMME and NEW_TAG_ROW) are exactly what the skill's write calls
// produced in temporary copies of both spreadsheets, read back as shown (which is how the Apps
// Script reads them).
//
// Runs with the other server function tests: npm run test:functions

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { handleSync } from "../../supabase/functions/sync/handler.ts";

const CODE = Deno.readTextFileSync(new URL("../../apps-script/Code.js", import.meta.url));
const SECRET = "a-dry-run-secret-that-is-long-enough-1234567890";

// ---- The sheets as they are today -------------------------------------------------------

// Header rows as read from the real sheets on 9 November 2026, trailing spaces included.
const BASIC_HEADERS = [
  "Programme Name", "Description", "Sign up date", "Duration ", "Language", "Experience level", "URL ",
  "Location ", "Costs ", "Partner (yes/no)",
];
const SOURCE_HEADERS: Record<string, string[]> = {
  "Volunteer work": BASIC_HEADERS,
  "Youth Organizations": BASIC_HEADERS,
  "Impact Driven Programmes": [
    "Programme Name", "Description", "Sign up date", "Duration ", "Language", "Experience level", "URL ",
    "Location ", "Costs ", "Interest ", "one-liner ", "Partner (yes/no)", "Sign-up deadline", "other notes ",
  ],
  "Paid Impact Programmes": [
    "Programme Name", "Description", "Sign up date", "Duration ", "Language", "Experience level", "URL ",
    "Location ", "Costs ", "Interest ", "one-liner ", "Partner (yes/no)", "Sign-up deadline",
  ],
  "Summer School Programmes": [
    "Programme Name", "Host university/institution", "Description", "Sign up date /moment", "Duration",
    "Language", "Experience level", "URL", "Location", "Costs", "Specific field of interest", "Partner (yes/no)",
  ],
  "Programs from other university": BASIC_HEADERS,
};
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

// The 139 programmes in the Catalogue today, per tab in the Catalogue's order (IDs are the tab's
// prefix plus their position: IDP-01, IDP-02, ...).
const PREFIX: Record<string, string> = {
  "Impact Driven Programmes": "IDP",
  "Volunteer work": "VOL",
  "Youth Organizations": "YTH",
  "Paid Impact Programmes": "PAID",
  "Summer School Programmes": "SUM",
  "Programs from other university": "UNI",
};
const EXISTING: Record<string, string[]> = {
  "Impact Driven Programmes": [
    "Externship", "Jonge Rewilders Nederland", "Young Rewilders Network (EYR)", "NAHSS",
    "United Netherlands delegation", "United Netherlands public speaking course (5 weeks)",
    "Humanity in Action fellowship", "Solve Consulting", "DKC", "Unipartners", "Young Lady Business Academy",
    "West Wing", "MDT missie", "UUMUN", "YEP Programmes", "Enactus",
    "Biobased Innovation Student Challenge (BISC-E)", "MDT", "Forward Inc.", "Feminist Climate Academy",
    "Food and Agriculture Organisation of the United Nations",
    "GoodShift – Administration & Operations Support",
    "GoodShift – Acquisition: Schools, Associations & Communities", "GoodShift – Charity Support",
    "GoodShift – Activation & Campaign Building", "GoodShift – Campaign Promotion / Field Support",
    "ReWild the Future Challenge", "Soapbox Challenges", "Nationale Weerbaarheids Training",
    "180 Degrees Consulting Amsterdam",
  ],
  "Volunteer work": [
    "VC Utrecht / Vrijwilligerscentrale Utrecht", "WWOOF Netherlands", "Workaway",
    "AZC (Asielzoekerscentrum) - Volunteering as Dutch language teacher / Event helper",
    "Ouderenzorg / Careibu – Elderly Care/Utrecht: Fietsen voor 2", "Meer Bomen Nu",
    "TreesForAll – Trees for Schools", "Groentetas Utrecht", "WNF (World Wildlife Fund Netherlands)",
    "Leger des Heils (Salvation Army Netherlands)", "Dierenambulance", "Voedselbank (Food Bank Netherlands)",
    "Kringloopwinkels (Thrift stores)", "Stichting Move", "Unicef Utrecht",
    "Utrecht University Volunteer Opportunities (Resource List)", "De Reparatiebalie", "Deep Canvassing",
    "DeGoedeZaak", "Serve the city Utrecht", "Worldpackers", "AIESEC Global Volunteer",
  ],
  "Youth Organizations": [
    "NJR", "Milieudefensie Jong", "Jonge Klimaatbeweging", "Studenten voor Morgen (Students for Tomorrow)",
    "Dwars (youth organization GroenLinks / GreenLeft)", "CHOICE for Youth and Sexuality", "JongRegio",
    "ISO / U-raad", "FNV Jong", "CNV Jong", "WWF-NL Youth Advisory Committee",
    "World's Youth for Climate Justice (WYCJ)", "A SEED Europe", "Youth and Environment Europe (YEE)",
    "European Sustainable Development Network (ESDN)", "MDT Jongerenpanel", "WECF — Funding Fairer Futures",
    "WO=MEN, Dutch Gender Platform", "Oma's Soep", "Amnesty International Student Groups",
    "ActionAid Netherlands", "Thirty030", "Ocean Love",
  ],
  "Paid Impact Programmes": [
    "Defensity College", "Youth Advisory Group (YAG)", "Blue Book Traineeship EU", "Nationale Denktank",
    "Energie Student", "Werken voor Nederland", "Ecological fieldwork (bats / vleermuizen)", "Teia",
    "inClimate", "Examentraining (e.g. Eindsprint)", "Operation Social Response", "Klimaatroute",
    "Waterhandjes", "KWR Water Research Institute", "Werkstudent BAM", "Waterschap De Stichtse Rijnlanden",
    "Waterprof", "Darel Education", "Smarttimer (Rijkswaterstaat)",
  ],
  "Summer School Programmes": [
    "NIOZ Marine Masters Summer Course", "Wadden Sea World Heritage Summer School",
    "Hands-on GIS for Earth Scientists", "NCK Summer School", "Summer School: Groundwater and Drought",
    "Summer Course: Freshwater Ecosystems", "Geoversity short courses",
    "Governing Climate Change: Theory and Practice", "Water Politics and Governance",
    "Global Energy Transition in a Fossil World", "Environmental Justice in Theory and Practice",
    "Circular Economy and the City",
    "Public Participation in Sustainable Transitions: Energy Island Ameland",
    "Discourses of Sustainability Transitions",
    "Participatory Processes in Agroecology and Landscape Restoration",
    "Islands as Lighthouses for Sustainability (ISLAS)", "Religion, Equity and Environmental Justice",
    "Sustainable Local Development and the Mining Industry",
    "Fate and Impact of (Micro- and Nano-)Plastics on Health", "Global Energy Transition",
    "Summer School on Digital and Green Transitions",
    "Climate Action Beyond Governments: Assessing and Strengthening Integrity",
    "Living Landscapes: Developing Society, Place and Self",
    "Food Systems and Ecology: Towards Sustainable Solutions",
    "Summer School Biotechnology, Agriculture and Food", "Planning and Design for the Just City",
    "Summer School on Circularity in the Built Environment", "Sustainable Housing from a European Perspective",
    "IDEA League: Advancing Decision Support", "The Future of Cities: Building Resilience to Climate Change",
    "The European Union, the United Nations and Global Governance",
    "EU Law in Transition: Business, Sustainability and Climate Change", "The Transition to a Circular Economy",
    "Smart Sustainable Cities", "Maastricht Summer School - policy analysis strand",
  ],
  "Programs from other university": [
    "Exchange to Sciences Po", "Schwarzman Scholars", "Biobased Transition / Biobased Technology (minor, WUR)",
    "Financing Sustainable Transitions (minor, WUR)", "Innovation & Entrepreneurship (minor, WUR)",
    "Gender and Diversity for Sustainable Worlds (minor, WUR)",
    "Plastics in the Environment and Society (minor, WUR)",
    "Climate-Resilient Crops: Interdisciplinary Approaches (minor, WUR)", "Leiden University",
    "Nationale Weerbaarheids Training",
  ],
};

// ---- The new programme, as the skill wrote it -------------------------------------------

type Shown = { value: Date; shown: string }; // a date cell: its value and the text the sheet shows
type Cell = string | Shown;
type Row = Record<string, Cell>;

// Read back from the temporary copies after the skill's write calls: 'Impact Driven Programmes'
// row 33 and Catalogue row 32 (inserted below IDP-30). The deadline is a real date in the sheet,
// shown as 2027-02-01.
const NEW_PROGRAMME: Row = {
  "Programme Name": "Delta Futures Water Challenge",
  "Description": "Fictional sample for a dry run of the add-programme skill. Student teams design ideas for " +
    "climate-proof water management in Dutch deltas, coached by water boards and engineers, and pitch them " +
    "to a jury. Open to bachelor and master students from any discipline, in teams of two to four.",
  "Sign up date": "Register before 1 February 2027",
  "Duration ": "February to May 2027, about 2-4 hours/week",
  "Language": "English",
  "Experience level": "1-2",
  "URL ": "https://www.example.org/delta-futures",
  "Location ": "Netherlands (Delft and online)",
  "Costs ": "Not paid (prizes: 1st €3,000)",
  "Interest ": "water",
  "one-liner ": "Design a climate-proof water idea with your team and pitch it to a jury of water " +
    "professionals. Get coaching from water boards and engineers along the way.",
  "Partner (yes/no)": "no",
  "Sign-up deadline": "1 Feb 2027",
  "other notes ": "",
};
const NEW_TAG_ROW: Row = {
  "ID": "IDP-31",
  "Programme name": "Delta Futures Water Challenge",
  "Source tab": "Impact Driven Programmes",
  "Type": "Competition / challenge",
  "Main field": "Water & Oceans",
  "Other fields": "Climate & Energy, Education, Activism & Engagement",
  "Specific topics": "climate adaptation, delta management, flood safety, water boards",
  "Ways of contributing": "Entrepreneurship & Innovation, Research & Analysis",
  "Skills you build": "pitching, teamwork, systems thinking",
  "Experience level": "1",
  "Hours per week": "2-4",
  "Costs": "Free (prize money)",
  "Language": "English",
  "Location": "Netherlands and online",
  "Deadline status": "Open",
  "Next deadline": { value: new Date("2027-02-01T00:00:00Z"), shown: "2027-02-01" },
  "Good fit for": "Students from any discipline who want to design and pitch water ideas in a team.",
  "Data to check": "",
};

// What the guide saves for it.
const EXPECTED_NEW_PROGRAMME = {
  id: "IDP-31",
  name: "Delta Futures Water Challenge",
  source_tab: "Impact Driven Programmes",
  type: "Competition / challenge",
  description: NEW_PROGRAMME["Description"],
  one_liner: NEW_PROGRAMME["one-liner "],
  url: "https://www.example.org/delta-futures",
  sign_up: "Register before 1 February 2027",
  deadline_details: "1 Feb 2027",
  duration: "February to May 2027, about 2-4 hours/week",
  location_details: "Netherlands (Delft and online)",
  costs_details: "Not paid (prizes: 1st €3,000)",
  host: null,
  main_field: "Water & Oceans",
  other_fields: ["Climate & Energy", "Education, Activism & Engagement"],
  topics: ["climate adaptation", "delta management", "flood safety", "water boards"],
  ways_of_contributing: ["Entrepreneurship & Innovation", "Research & Analysis"],
  skills: ["pitching", "teamwork", "systems thinking"],
  experience_level: 1,
  hours_per_week: "2-4",
  costs: "Free (prize money)",
  languages: ["English"],
  location: "Netherlands and online",
  deadline_status: "Open",
  next_deadline: "2027-02-01",
  good_fit_for: "Students from any discipline who want to design and pitch water ideas in a team.",
};

// ---- Building the stand-in sheets --------------------------------------------------------

type Addition = {
  tab: string;
  programme?: Row; // the programme row, added below the tab's last row (left out: not written)
  tag?: Row; // the tag row, inserted below the highest ID of the tab's prefix (left out: not written)
};

function existingTagRow(id: string, name: string, tab: string): Row {
  return {
    "ID": id, "Programme name": name, "Source tab": tab, "Type": "Fellowship / programme",
    "Main field": "Nature & Biodiversity", "Other fields": "", "Specific topics": "stand-in topic",
    "Ways of contributing": "Research & Analysis", "Skills you build": "", "Experience level": "1",
    "Hours per week": "", "Costs": "Free", "Language": "English", "Location": "Netherlands",
    "Deadline status": "Unknown", "Next deadline": "", "Good fit for": "Stand-in for an existing programme.",
    "Data to check": "",
  };
}

function inOrder(headers: string[], row: Row): Cell[] {
  return headers.map((header) => row[header] ?? "");
}

function makeSheets(additions: Addition[]) {
  const programmes: Record<string, Cell[][]> = {};
  const catalogue: Cell[][] = [CATALOGUE_HEADERS];
  for (const [tab, names] of Object.entries(EXISTING)) {
    const headers = SOURCE_HEADERS[tab];
    const grid: Cell[][] = [headers];
    names.forEach((name, index) => {
      grid.push(inOrder(headers, { "Programme Name": name, "Description": "Existing programme (stand-in)." }));
      // The real Impact Driven Programmes tab has an empty row 14, below West Wing.
      if (tab === "Impact Driven Programmes" && name === "West Wing") grid.push([]);
      const id = `${PREFIX[tab]}-${String(index + 1).padStart(2, "0")}`;
      catalogue.push(inOrder(CATALOGUE_HEADERS, existingTagRow(id, name, tab)));
    });
    for (const addition of additions.filter((item) => item.tab === tab)) {
      if (addition.programme) grid.push(inOrder(headers, addition.programme));
      if (addition.tag) catalogue.push(inOrder(CATALOGUE_HEADERS, addition.tag));
    }
    programmes[tab] = grid;
  }
  return { programmes, catalogue, alumni: [ALUMNI_HEADERS] as Cell[][] };
}

// ---- Stand-ins for Google's services (as in apps-script/code_test.ts) --------------------

const isShown = (cell: Cell): cell is Shown => typeof cell === "object" && "shown" in cell;

class FakeSheet {
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
    return {
      getValues: () => cells.map((line) => line.map((cell) => (isShown(cell) ? cell.value : cell))),
      getDisplayValues: () => cells.map((line) => line.map((cell) => (isShown(cell) ? cell.shown : String(cell)))),
    };
  }
}

function fakeFile(name: string, tabs: Record<string, Cell[][]>) {
  const sheets = Object.fromEntries(Object.entries(tabs).map(([tab, grid]) => [tab, new FakeSheet(grid)]));
  return { getName: () => name, getSheetByName: (tab: string) => sheets[tab] ?? null };
}

type Answer = { status: number; body: unknown };
type Sent = { headers: Record<string, string>; payload: string };

// Runs syncNow once against the stand-in sheets. Returns the report it logs and what it sent.
function runAppsScript(sheets: ReturnType<typeof makeSheets>, answer: Answer) {
  const files: Record<string, ReturnType<typeof fakeFile>> = {
    "1jIjZ15sPo5i6OIOW4dlv1kAlTT-2qObawFDdMUF4Ejc": fakeFile("Programmes Database", sheets.programmes),
    "162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY": fakeFile("Catalogue", { Catalogue: sheets.catalogue }),
    "1bMsC5tPuzI195xlvU2UIm-ITMMsHyFR_bVTGqdmE3-Q": fakeFile("Alumni", { "Formulierreacties 1": sheets.alumni }),
  };
  const sent: Sent[] = [];
  const logs: string[] = [];
  const globals: Record<string, unknown> = {
    SpreadsheetApp: { openById: (id: string) => files[id] },
    UrlFetchApp: {
      fetch: (_url: string, options: Sent) => {
        sent.push({ headers: options.headers, payload: options.payload });
        return { getResponseCode: () => answer.status, getContentText: () => JSON.stringify(answer.body) };
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key: string) => (key === "SYNC_SECRET_TEST" ? SECRET : null) }),
    },
    Utilities: { formatDate: () => "2026-11-09 12:00" },
    Session: { getScriptTimeZone: () => "Europe/Amsterdam" },
    console: { log: (message: string) => logs.push(message) },
  };
  const names = Object.keys(globals);
  const script = new Function(...names, `${CODE}\nreturn { syncNow };`)(...names.map((name) => globals[name]));
  script.syncNow();
  return { report: logs.join("\n"), sent };
}

// The whole hourly sync for these sheets: the Apps Script collects and sends the data, the sync
// function (the real handler) checks it and saves it in a stand-in database, and the Apps Script
// logs the report with the function's answer.
async function sync(additions: Addition[]) {
  const sheets = makeSheets(additions);
  const placeholder = { status: 200, body: { ok: true, saved: { programmes: 0, alumni: 0 }, leftOut: { programmes: 0, alumni: 0 } } };
  const { sent } = runAppsScript(sheets, placeholder);
  assertEquals(sent.length, 1, "the data is sent to the test environment only");

  const saved: { programmes: Record<string, unknown>[]; alumni: unknown[] }[] = [];
  const response: Response = await handleSync(
    new Request("http://localhost/sync", { method: "POST", headers: sent[0].headers, body: sent[0].payload }),
    {
      environment: "dry-run",
      syncSecret: SECRET,
      save: (programmes: Record<string, unknown>[], alumni: unknown[]) => {
        saved.push({ programmes, alumni });
        return Promise.resolve({ programmes: programmes.length, alumni: alumni.length });
      },
    },
  );
  const body = await response.json();
  const { report } = runAppsScript(sheets, { status: response.status, body });
  const savedProgrammes = saved[0]?.programmes ?? [];
  return {
    status: response.status,
    body,
    report,
    savedIds: savedProgrammes.map((row) => row.id as string),
    savedRow: (id: string) => savedProgrammes.find((row) => row.id === id),
  };
}

const ADD_SAMPLE: Addition = { tab: "Impact Driven Programmes", programme: NEW_PROGRAMME, tag: NEW_TAG_ROW };

function withChanges(changes: { programme?: Row; tag?: Row }): Addition {
  return {
    tab: "Impact Driven Programmes",
    programme: { ...NEW_PROGRAMME, ...changes.programme },
    tag: { ...NEW_TAG_ROW, ...changes.tag },
  };
}

// The report's problem lines, without the heading.
function problemLines(report: string): string[] {
  return report.split("\n").filter((line) => line.startsWith("- "));
}

// ---- Tests -------------------------------------------------------------------------------

Deno.test("the stand-in sheets hold the 139 programmes of today", async () => {
  const counts = Object.fromEntries(Object.entries(EXISTING).map(([tab, names]) => [PREFIX[tab], names.length]));
  assertEquals(counts, { IDP: 30, VOL: 22, YTH: 23, PAID: 19, SUM: 35, UNI: 10 });
  const today = await sync([]);
  assertEquals(today.status, 200);
  assertEquals(today.savedIds.length, 139);
  assertStringIncludes(today.report, "No problems found.");
});

Deno.test("the sample programme written by the skill reaches the guide, with every tag as written", async () => {
  const result = await sync([ADD_SAMPLE]);

  assertEquals(result.status, 200);
  assertEquals(result.body.problems, []);
  assertEquals(result.body.notes, []);
  assertEquals(result.body.received.programmes, 140);
  assertEquals(result.body.saved.programmes, 140);
  assertEquals(result.body.leftOut.programmes, 0);
  assertEquals(result.savedRow("IDP-31"), EXPECTED_NEW_PROGRAMME);

  const report = result.report.split("\n").slice(1); // without the date line
  assertEquals(report, [
    "Read 140 catalogue rows, 140 programmes and 0 alumni form responses. Sent 140 programmes and 0 alumni with permission.",
    "",
    "test: saved 140 programmes and 0 alumni (left out: 0 programmes, 0 alumni).",
    "",
    "No problems found.",
  ]);
});

Deno.test("a summer school sample, with that tab's own column names, also reaches the guide", async () => {
  const result = await sync([{
    tab: "Summer School Programmes",
    programme: {
      "Programme Name": "Climate-Proof Cities Summer Course",
      "Host university/institution": "Example University",
      "Description": "Fictional sample for a dry run of the add-programme skill.",
      "Sign up date /moment": "Applications open in February 2027",
      "Duration": "2 weeks in July 2027",
      "Language": "English",
      "Experience level": "3",
      "URL": "https://www.example.org/summer-course",
      "Location": "Utrecht",
      "Costs": "€750 (housing not included)",
      "Specific field of interest": "urban planning",
      "Partner (yes/no)": "no",
    },
    tag: {
      "ID": "SUM-36", "Programme name": "Climate-Proof Cities Summer Course", "Source tab": "Summer School Programmes",
      "Type": "Summer school", "Main field": "Cities & Built Environment", "Other fields": "Climate & Energy",
      "Specific topics": "urban heat, climate adaptation, green infrastructure",
      "Ways of contributing": "Research & Analysis, Technical & Data",
      "Skills you build": "spatial analysis, design thinking", "Experience level": "3",
      "Hours per week": "full-time (2 weeks)", "Costs": "Costs money", "Language": "English", "Location": "Utrecht",
      "Deadline status": "Not announced", "Next deadline": "",
      "Good fit for": "Master's students who want to design cities that cope with heat and flooding.",
      "Data to check": "Fee for 2027 not confirmed yet.",
    },
  }]);

  assertEquals(result.body.problems, []);
  assertEquals(result.body.saved.programmes, 140);
  const row = result.savedRow("SUM-36");
  assert(row, "SUM-36 is saved");
  assertEquals(row.host, "Example University");
  assertEquals(row.sign_up, "Applications open in February 2027");
  assertEquals(row.costs, "Costs money");
  assertEquals(row.experience_level, 3);
  assertEquals(row.next_deadline, null);
  assert(!JSON.stringify(result.body).includes("Fee for 2027"), "Data to check is never sent");
});

// Drafted by a separate agent that only had the skill and a pasted page text (a fictional minor).
// It belongs to the last group in the Catalogue, so its tag row became the sheet's last row (141).
Deno.test("an independent agent's draft for a minor, added as the Catalogue's last row, reaches the guide", async () => {
  const result = await sync([{
    tab: "Programs from other university",
    programme: {
      "Programme Name": "Minor Climate-Resilient Deltas",
      "Description": "Minor at Example University of Applied Sciences where you work in an interdisciplinary team " +
        "on a real assignment from a Dutch water board: how a delta region can adapt to sea level rise and heavier " +
        "rainfall. You follow lectures on hydrology, spatial planning and water governance, do fieldwork, and " +
        "present your advice to the water board at the end. Open to third-year bachelor students from any Dutch " +
        "university or university of applied sciences, with no hydrology background needed; last year all 40 " +
        "places were taken.",
      "Sign up date": "Register from 1 April to 15 May 2027 via Kies op Maat",
      "Duration ": "September 2027 to January 2028, full-time (15 ECTS)",
      "Language": "English",
      "Experience level": "2",
      "URL ": "https://www.example.org/minor-climate-resilient-deltas",
      "Location ": "Rotterdam (two field weeks in Zeeland)",
      "Costs ": "No extra tuition for students enrolled at a Dutch institution; about €150 for accommodation " +
        "during the field weeks",
      "Partner (yes/no)": "no",
    },
    tag: {
      "ID": "UNI-11", "Programme name": "Minor Climate-Resilient Deltas", "Source tab": "Programs from other university",
      "Type": "Minor / exchange", "Main field": "Water & Oceans", "Other fields": "Climate & Energy, Policy & Governance",
      "Specific topics": "climate adaptation, delta management, sea level rise, hydrology, spatial planning",
      "Ways of contributing": "Consulting & Strategy, Research & Analysis",
      "Skills you build": "interdisciplinary teamwork, fieldwork, policy advice, presenting", "Experience level": "2",
      "Hours per week": "full-time (September to January)", "Costs": "Costs money", "Language": "English",
      "Location": "Netherlands", "Deadline status": "Closed",
      "Next deadline": { value: new Date("2027-05-15T00:00:00Z"), shown: "2027-05-15" },
      "Good fit for": "Students who want to work in an interdisciplinary team on a real climate adaptation " +
        "assignment for a Dutch water board.",
      "Data to check": "Page says 15 ECTS but full-time from September to January; check the weekly load.",
    },
  }]);

  assertEquals(result.body.problems, []);
  assertEquals(result.body.saved.programmes, 140);
  const row = result.savedRow("UNI-11");
  assert(row, "UNI-11 is saved");
  assertEquals(row.source_tab, "Programs from other university");
  assertEquals(row.other_fields, ["Climate & Energy", "Policy & Governance"]);
  assertEquals(row.experience_level, 2);
  assertEquals(row.deadline_status, "Closed");
  assertEquals(row.next_deadline, "2027-05-15");
});

// Each rule in the skill's "Before you show the draft" list, broken on purpose: the sync must
// catch it. This shows the list matches what the sync really checks.

Deno.test("without the tag row, the programme stays out and the report says why", async () => {
  const result = await sync([{ tab: "Impact Driven Programmes", programme: NEW_PROGRAMME }]);
  assertEquals(result.body.saved.programmes, 139);
  assertEquals(problemLines(result.report), [
    "- Impact Driven Programmes row 33 (Delta Futures Water Challenge), Programme Name: has no row in the Catalogue yet, so it is not sent.",
  ]);
});

Deno.test("a name that differs between the two rows breaks the join", async () => {
  const result = await sync([withChanges({ tag: { "Programme name": "Delta Futures Water Challenge 2027" } })]);
  assertEquals(result.body.saved.programmes, 139);
  assertEquals(problemLines(result.report), [
    '- Catalogue row 32 (IDP-31, Delta Futures Water Challenge 2027), Programme name: was not found in the tab "Impact Driven Programmes" of the Programmes Database. The names must match.',
    "- Impact Driven Programmes row 33 (Delta Futures Water Challenge), Programme Name: has no row in the Catalogue yet, so it is not sent.",
  ]);
});

Deno.test("capitals and extra spaces in the name don't matter", async () => {
  const result = await sync([withChanges({ tag: { "Programme name": "delta  futures water CHALLENGE" } })]);
  assertEquals(result.body.problems, []);
  assertEquals(result.body.saved.programmes, 140);
});

Deno.test("a name that is already in the tab leaves both programmes out", async () => {
  const result = await sync([withChanges({
    programme: { "Programme Name": "Soapbox Challenges" },
    tag: { "Programme name": "Soapbox Challenges" },
  })]);
  assertEquals(result.body.saved.programmes, 138, "IDP-28 is left out too");
  assertStringIncludes(result.report, 'Programme name: appears more than once in the tab "Impact Driven Programmes"');
});

Deno.test("an ID that is already used leaves both programmes out", async () => {
  const result = await sync([withChanges({ tag: { "ID": "IDP-30" } })]);
  assertEquals(result.body.saved.programmes, 138, "IDP-30 (180 Degrees Consulting Amsterdam) is left out too");
  assertStringIncludes(result.report, "ID: The ID IDP-30 is used by more than one row in the Catalogue.");
});

Deno.test("an ID in another form is a problem", async () => {
  const result = await sync([withChanges({ tag: { "ID": "IDP 31" } })]);
  assertStringIncludes(result.report, 'ID: "IDP 31" should look like IDP-01.');
  assertEquals(result.body.saved.programmes, 139);
});

Deno.test("a value outside the allowed lists is a problem", async () => {
  const cases: [string, string, string][] = [
    ["Type", "Hackathon", '"Hackathon" is not one of'],
    ["Main field", "Water", '"Water" is not one of'],
    ["Ways of contributing", "Fieldwork", '"Fieldwork" is not one of'],
    ["Costs", "Not paid", '"Not paid" is not one of'],
    ["Language", "Dutch/English", '"Dutch/English" is not one of'],
    ["Location", "Delft", '"Delft" is not one of'],
    ["Deadline status", "Open until February", '"Open until February" is not one of'],
    ["Experience level", "1-2", '"1-2" is not one of'],
    ["Experience level", "4", '"4" is not one of'],
  ];
  for (const [column, value, message] of cases) {
    const result = await sync([withChanges({ tag: { [column]: value } })]);
    assertEquals(result.body.saved.programmes, 139, `${column}: ${value}`);
    assertStringIncludes(result.report, `${column}: ${message}`);
  }
});

Deno.test("more than two other fields, or an empty required tag, is a problem", async () => {
  const tooMany = await sync([withChanges({ tag: { "Other fields": "Climate & Energy, Nature & Biodiversity, Policy & Governance" } })]);
  assertStringIncludes(tooMany.report, "Other fields: has 3 fields; use at most 2.");
  for (const column of ["Specific topics", "Ways of contributing", "Good fit for", "Main field"]) {
    const result = await sync([withChanges({ tag: { [column]: "" } })]);
    assertEquals(result.body.saved.programmes, 139, column);
    assertStringIncludes(result.report, `${column}: is empty`);
  }
});

Deno.test("a deadline that isn't shown as YYYY-MM-DD is a problem", async () => {
  for (const shown of ["1-2-2027", "1 Feb 2027", "2027-02-30"]) {
    const result = await sync([withChanges({ tag: { "Next deadline": shown } })]);
    assertEquals(result.body.saved.programmes, 139, shown);
    assertStringIncludes(result.report, `Next deadline: "${shown}" is not a date written as YYYY-MM-DD`);
  }
});

Deno.test("a URL cell with anything besides one web address is a problem", async () => {
  for (const url of ["https://www.example.org/delta-futures (see FAQ)", "www.example.org", "https://a.org https://b.org"]) {
    const result = await sync([withChanges({ programme: { "URL ": url } })]);
    assertEquals(result.body.saved.programmes, 139, url);
    assertStringIncludes(result.report, "Impact Driven Programmes row 33 (IDP-31, Delta Futures Water Challenge), URL:");
  }
});

Deno.test("a topic longer than 80 characters (a missing comma) is a problem", async () => {
  const result = await sync([withChanges({
    tag: { "Specific topics": "climate adaptation and delta management and flood safety and the work of water boards" },
  })]);
  assertStringIncludes(result.report, "Specific topics:");
  assertStringIncludes(result.report, "is longer than 80 characters. Separate items with commas.");
});
