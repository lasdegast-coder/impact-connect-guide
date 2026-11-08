// The values the Catalogue sheet may use, as described in its "Fields and roles" and
// "How this sheet works" tabs. Values are matched ignoring capitals and extra spaces, and saved
// in the spelling below. When the team starts using a new value in the sheet, add it here too,
// then deploy the function; until then the sync reports the row as a problem.

export const SOURCE_TABS = [
  "Volunteer work",
  "Youth Organizations",
  "Impact Driven Programmes",
  "Paid Impact Programmes",
  "Summer School Programmes",
  "Programs from other university",
] as const;

export const TYPES = [
  "Fellowship / programme",
  "Network / community",
  "Course / training",
  "Student consultancy",
  "Paid job / traineeship",
  "Competition / challenge",
  "Volunteering",
  "Youth organisation",
  "Summer school",
  "Minor / exchange",
] as const;

export const FIELDS = [
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
] as const;

export const WAYS_OF_CONTRIBUTING = [
  "Research & Analysis",
  "Policy & Advocacy",
  "Entrepreneurship & Innovation",
  "Consulting & Strategy",
  "Hands-on & Fieldwork",
  "Campaigning & Community",
  "Technical & Data",
  "Communication & Education",
  "Care & Social Support",
] as const;

// "Free (prize money)": free to join, with prize money to win. "Paid": the student earns money.
export const COSTS = ["Free", "Costs money", "Paid", "Free (prize money)"] as const;

// The Language column, and the languages each value stands for.
export const LANGUAGES: Record<string, string[]> = {
  "English": ["English"],
  "Dutch": ["Dutch"],
  "English and Dutch": ["English", "Dutch"],
};

export const LOCATIONS = [
  "Netherlands",
  "Utrecht",
  "Online",
  "International",
  "Netherlands and online",
] as const;

export const DEADLINE_STATUSES = ["Open", "Rolling", "Closed", "Not announced", "Unknown"] as const;

export const EXPERIENCE_LEVELS = ["1", "2", "3"] as const;

// "Other fields" holds at most this many extra fields.
export const MAX_OTHER_FIELDS = 2;
