import { assert, assertEquals, assertFalse, assertStringIncludes, assertThrows } from "jsr:@std/assert@1";
import { checkSyncRequest, hasContactDetails, RequestError } from "./validate.ts";
import { alumnus, programme } from "./test_data.ts";

function check(programmes: unknown[], alumni: unknown[] = []) {
  return checkSyncRequest({ programmes, alumni });
}

// Programmes

Deno.test("a correct programme becomes a database row", () => {
  const result = check([programme({ otherFields: "Policy & Governance", nextDeadline: "2026-11-16" })]);
  assertEquals(result.problems, []);
  assertEquals(result.programmes, [{
    id: "IDP-01",
    name: "Test Externship",
    source_tab: "Impact Driven Programmes",
    type: "Fellowship / programme",
    description: "An online externship with a big GIS project.",
    one_liner: null,
    url: "https://www.example.org/externships",
    sign_up: "3 cohorts per year",
    deadline_details: "Not announced",
    duration: "6 to 12 weeks",
    location_details: "International (online)",
    costs_details: "Not paid",
    host: null,
    main_field: "Nature & Biodiversity",
    other_fields: ["Policy & Governance"],
    topics: ["conservation", "gis", "remote project work"],
    ways_of_contributing: ["Research & Analysis", "Technical & Data"],
    skills: ["gis", "project work"],
    experience_level: 1,
    hours_per_week: "10-15",
    costs: "Free",
    languages: ["English"],
    location: "Online",
    deadline_status: "Not announced",
    next_deadline: "2026-11-16",
    good_fit_for: "Students who want remote, international project experience.",
  }]);
});

Deno.test("a field with a comma in its name stays one field", () => {
  const result = check([programme({ otherFields: "Education, Activism & Engagement, Climate & Energy" })]);
  assertEquals(result.problems, []);
  assertEquals(result.programmes[0].other_fields, ["Education, Activism & Engagement", "Climate & Energy"]);
});

Deno.test("values are matched ignoring capitals and extra spaces, and saved in the standard spelling", () => {
  const result = check([programme({ language: "english  and dutch", costs: "costs money", location: " utrecht " })]);
  assertEquals(result.problems, []);
  assertEquals(result.programmes[0].languages, ["English", "Dutch"]);
  assertEquals(result.programmes[0].costs, "Costs money");
  assertEquals(result.programmes[0].location, "Utrecht");
});

Deno.test("the main field is not repeated in other fields", () => {
  const result = check([programme({ otherFields: "Nature & Biodiversity, Water & Oceans" })]);
  assertEquals(result.programmes[0].other_fields, ["Water & Oceans"]);
});

Deno.test("an unknown value leaves the programme out and names the allowed values", () => {
  const result = check([programme({ costs: "Gratis" })]);
  assertEquals(result.programmes, []);
  assertEquals(result.problems, [{
    where: "Catalogue row 2 (IDP-01, Test Externship)",
    column: "Costs",
    message: '"Gratis" is not one of: Free, Costs money, Paid, Free (prize money).',
  }]);
});

Deno.test("every controlled column is checked", () => {
  const result = check([programme({
    sourceTab: "Old tab",
    type: "Job",
    mainField: "Space",
    otherFields: "Climate & Energy, Fun",
    waysOfContributing: "Dancing",
    experienceLevel: "4",
    language: "French",
    location: "Mars",
    deadlineStatus: "Soon",
  })]);
  assertEquals(result.programmes, []);
  assertEquals(
    result.problems.map((problem) => problem.column),
    [
      "Source tab",
      "Type",
      "Main field",
      "Other fields",
      "Ways of contributing",
      "Experience level",
      "Language",
      "Location",
      "Deadline status",
    ],
  );
});

Deno.test("at most two other fields", () => {
  const result = check([programme({ otherFields: "Climate & Energy, Water & Oceans, Food & Agriculture" })]);
  assertEquals(result.programmes, []);
  assertStringIncludes(result.problems[0].message, "use at most 2");
});

Deno.test("required columns may not be empty", () => {
  const result = check([programme({ name: "", topics: " ", waysOfContributing: "", goodFitFor: "", mainField: "" })]);
  assertEquals(result.programmes, []);
  assertEquals(
    result.problems.map((problem) => `${problem.column}: ${problem.message}`).sort(),
    [
      "Good fit for: is empty.",
      "Main field: is empty. Use one of: " + [
        "Climate & Energy",
        "Nature & Biodiversity",
        "Water & Oceans",
        "Food & Agriculture",
        "Circular Economy & Materials",
        "Cities & Built Environment",
        "Sustainable Business & Finance",
        "Policy & Governance",
        "Social Justice & Inclusion",
        "International Development",
        "Health & Wellbeing",
        "Education, Activism & Engagement",
        "Personal & Career Development",
      ].join(", ") + ".",
      "Programme Name: is empty.",
      "Specific topics: is empty.",
      "Ways of contributing: is empty.",
    ],
  );
});

Deno.test("a URL must be one web address", () => {
  const bad = [
    "https://www.example.org/a & https://www.example.org/b",
    "No direct URL, search for it",
    "www.example.org",
    "https://example.org/ (our ref. doc)",
    "mailto:info@example.org",
  ];
  for (const url of bad) {
    const result = check([programme({ url })]);
    assertEquals(result.programmes, [], url);
    assertEquals(result.problems[0].column, "URL");
    assertEquals(result.problems[0].where, "Impact Driven Programmes row 5 (IDP-01, Test Externship)");
  }
  const result = check([programme({ url: "\nhttps://www.example.org/  " })]);
  assertEquals(result.programmes[0].url, "https://www.example.org/");
  assertEquals(check([programme({ url: "" })]).programmes[0].url, null);
});

Deno.test("the next deadline must be a real date written as YYYY-MM-DD", () => {
  for (const nextDeadline of ["16-11-2026", "2026-02-30", "next week"]) {
    const result = check([programme({ nextDeadline })]);
    assertEquals(result.programmes, [], nextDeadline);
    assertEquals(result.problems[0].column, "Next deadline");
  }
});

Deno.test("an ID that looks wrong or is used twice leaves the programmes out", () => {
  assertEquals(check([programme({ id: "idp 1" })]).programmes, []);
  const result = check([programme(), programme({ catalogueRow: 9, name: "Other" }), programme({ id: "IDP-02" })]);
  assertEquals(result.programmes.map((row) => row.id), ["IDP-02"]);
  assertEquals(result.problems.length, 2);
  assertStringIncludes(result.problems[0].message, "IDP-01 is used by more than one row");
});

// Alumni

Deno.test("an alumnus with permission becomes a database row, without tracking parts in the LinkedIn link", () => {
  const result = check([programme()], [
    alumnus({
      linkedin: "https://www.linkedin.com/in/test-alumna/?lipi=urn%3Ali%3Apage",
      bachelor: "-",
      previousOccupation: "",
    }),
  ]);
  assertEquals(result.problems, []);
  assertEquals(result.alumni, [{
    responded_at: "2026-09-02T09:27:44.000Z",
    consent: true,
    full_name: "Test Alumna",
    bachelor: null,
    master: "Sustainable Development",
    current_occupation: "Policy advisor",
    previous_occupation: null,
    fields_of_interest: "Energy transition, LCA, policy",
    linkedin_url: "https://www.linkedin.com/in/test-alumna/",
  }]);
});

Deno.test("a LinkedIn link without https:// is completed; anything else is refused", () => {
  const ok = check([programme()], [alumnus({ linkedin: "nl.linkedin.com/in/test" })]);
  assertEquals(ok.alumni[0].linkedin_url, "https://nl.linkedin.com/in/test");
  for (const linkedin of ["Test Alumna", "https://www.example.org/in/test", "@test", "https://linkedin.com.evil.org/in/x"]) {
    const result = check([programme()], [alumnus({ linkedin })]);
    assertEquals(result.alumni, [], linkedin);
    assertEquals(result.problems[0].column, "LinkedIn");
  }
});

Deno.test("an alumnus without permission is never saved", () => {
  for (const consent of [false, undefined]) {
    const record = alumnus();
    if (consent === undefined) delete record.consent;
    else record.consent = consent;
    const result = check([programme()], [record]);
    assertEquals(result.alumni, []);
    assertEquals(result.problems[0].where, "Alumni row 2");
    assertStringIncludes(result.problems[0].message, "no permission");
  }
});

Deno.test("an email address or phone number in any alumni field leaves the alumnus out, without quoting it", () => {
  const columns = ["fullName", "bachelor", "master", "currentOccupation", "previousOccupation", "fieldsOfInterest"];
  for (const column of columns) {
    for (const contact of ["reach me at test.alumna@example.org", "call 06-12345678"]) {
      const result = check([programme()], [alumnus({ [column]: contact })]);
      assertEquals(result.alumni, [], `${column}: ${contact}`);
      assertStringIncludes(result.problems[0].message, "email address or phone number");
      assertFalse(JSON.stringify(result).includes(contact), "the report never repeats the value");
    }
  }
});

Deno.test("alumni problems never quote what the alumnus wrote", () => {
  const result = check([programme()], [
    alumnus({ fullName: "", currentOccupation: "x".repeat(301), linkedin: "Secret Value 123" }),
  ]);
  assertEquals(result.alumni, []);
  assertEquals(result.problems.length, 3);
  assertFalse(JSON.stringify(result.problems).includes("Secret Value"));
  assertFalse(JSON.stringify(result.problems).includes("xxx"));
});

Deno.test("a missing form timestamp or a duplicate one leaves the alumnus out", () => {
  assertEquals(check([programme()], [alumnus({ respondedAt: "" })]).alumni, []);
  assertEquals(check([programme()], [alumnus({ respondedAt: "2-9-2026 11:27:44" })]).alumni, []);
  const result = check([programme()], [alumnus(), alumnus({ row: 3, fullName: "Test Alumnus" })]);
  assertEquals(result.alumni, []);
  assertEquals(result.problems.map((problem) => problem.where), ["Alumni row 2", "Alumni row 3"]);
});

Deno.test("ordinary text with years, numbers and an @ sign is accepted", () => {
  const result = check([programme()], [
    alumnus({
      previousOccupation: "Analyst @ a ministry (2019-2023), ISO 14001 auditor",
      fieldsOfInterest: "CO2 prestatieladder, 60 ECTS minor, SDG 13",
    }),
  ]);
  assertEquals(result.problems, []);
  assertEquals(result.alumni.length, 1);
});

Deno.test("recognising contact details", () => {
  for (const text of [
    "test.alumna@example.org",
    "TEST@EXAMPLE.NL",
    "06-12345678",
    "06 1234 5678",
    "+31 6 12345678",
    "0031612345678",
    "(030) 123 4567",
  ]) {
    assert(hasContactDetails(text), text);
  }
  for (const text of ["2019-2023", "2015-2019, 2019-2023", "ISO 14001", "Consultant @ Deloitte", "60 ECTS", ""]) {
    assertFalse(hasContactDetails(text), text);
  }
});

// The request as a whole

Deno.test("a request with the wrong shape is refused as a whole", () => {
  const refused = (body: unknown, message: string) =>
    assertStringIncludes(assertThrows(() => checkSyncRequest(body), RequestError).message, message);

  refused("text", "must be a JSON object");
  refused({ programmes: [] , alumni: [] }, "No programmes were sent");
  refused({ programmes: [programme()] }, "list of alumni");
  refused({ programmes: [programme()], alumni: [], extra: true }, "Unknown part");
  refused({ programmes: [programme({ partner: "yes" })], alumni: [] }, 'unknown column "partner"');
  refused({ programmes: [programme({ costs: 0 })], alumni: [] }, "wrong type");
  refused({ programmes: [programme({ catalogueRow: undefined })], alumni: [] }, "row number");
  refused({ programmes: [programme()], alumni: [alumnus({ consent: "yes" })] }, "wrong type");
  refused({ programmes: [programme()], alumni: [alumnus({ row: 0 })] }, "row number");
});

Deno.test("contact columns are refused as a whole, so nothing is saved", () => {
  for (const column of ["Phone number", "email", "Email ", "telephone"]) {
    const error = assertThrows(
      () => checkSyncRequest({ programmes: [programme()], alumni: [alumnus({ [column]: "x" })] }),
      RequestError,
    );
    assertStringIncludes(error.message, "Contact details are never accepted");
  }
});
