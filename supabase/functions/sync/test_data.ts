// Made-up rows in the shape the Apps Script sends, for the tests. No real alumni data.

export function programme(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    catalogueRow: 2,
    sourceRow: 5,
    id: "IDP-01",
    sourceTab: "Impact Driven Programmes",
    type: "Fellowship / programme",
    mainField: "Nature & Biodiversity",
    otherFields: "",
    topics: "conservation, gis, remote project work",
    waysOfContributing: "Research & Analysis, Technical & Data",
    skills: "gis, project work",
    experienceLevel: "1",
    hoursPerWeek: "10-15",
    costs: "Free",
    language: "English",
    location: "Online",
    deadlineStatus: "Not announced",
    nextDeadline: "",
    goodFitFor: "Students who want remote, international project experience.",
    name: "Test Externship",
    description: "An online externship with a big GIS project.",
    oneLiner: "",
    url: "https://www.example.org/externships",
    signUp: "3 cohorts per year",
    deadlineDetails: "Not announced",
    duration: "6 to 12 weeks",
    locationDetails: "International (online)",
    costsDetails: "Not paid",
    host: "",
    ...changes,
  };
}

export function alumnus(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    row: 2,
    respondedAt: "2026-09-02T09:27:44.000Z",
    consent: true,
    fullName: "Test Alumna",
    bachelor: "Future Planet Studies",
    master: "Sustainable Development",
    currentOccupation: "Policy advisor",
    previousOccupation: "Board member of a youth climate organisation",
    fieldsOfInterest: "Energy transition, LCA, policy",
    linkedin: "https://www.linkedin.com/in/test-alumna",
    ...changes,
  };
}
