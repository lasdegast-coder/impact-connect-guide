---
name: "add-programme-to-database"
description: "Use when a link to a programme, challenge, fellowship, internship, course or volunteering opportunity is shared for the Impact Connect programmes database, or when a programme in that database still needs its Catalogue tag row. Reads the page, drafts the programme row and its Catalogue tag row for the student guide, and writes both after one approval."
---

# Add a programme to the Impact Connect programmes database

Every programme needs two rows:

1. a **programme row** in the Programmes Database: the details the website and the student guide show;
2. a **tag row** in the Catalogue: the tags the student guide uses to match the programme to students.

Every hour, the student guide's sync joins the two rows on source tab and programme name, and checks each tag against fixed lists. A programme without a matching, valid tag row never reaches the guide, and the sync reports it as a problem (by email) until it is fixed. So always draft both rows, show them together, and write both after one approval.

## The two files

**LINKED TO WEBSITE Programmes Database (Google Sheets)**
Spreadsheet ID: `1jIjZ15sPo5i6OIOW4dlv1kAlTT-2qObawFDdMUF4Ejc`

This is the live master that feeds the website. There are older lookalikes in Drive — a `.xlsx` with almost the same name (read-only, cannot be edited through the API) and a sheet marked "NIET verbonden aan IC website". Never write to those. If the ID above fails, search Drive for the title rather than guessing.

**Programmes Catalogue for Matching Platform (Google Sheets)**
Spreadsheet ID: `162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY`, tab `Catalogue` (sheet ID `0`), columns A–R.

Its tabs "How this sheet works" and "Fields and roles" explain the tags. "Fields and roles" counts the programmes per field with formulas, so it updates by itself. Write plain values only, never formulas. (If a formula is ever needed there: this file uses a Dutch locale, so arguments are separated by `;`.)

## Tabs, and which one to pick

| Tab | What goes here | Catalogue ID prefix | Sheet ID |
|---|---|---|---|
| Volunteer work | Open-ended volunteering, no selection, join any time | VOL | 562032160 |
| Youth Organizations | Membership of an organisation, youth council, board or working group | YTH | 1221317339 |
| Summer School Programmes | Courses hosted by a university, usually with ECTS and a fee | SUM | 6575484 |
| Impact Driven Programmes | Competitions, challenges, traineeships, student consultancy, fellowships, platforms — unpaid or prize-based | IDP | 1914001672 |
| Programs from other university | Minors, tracks, exchanges and scholarships at other universities (also universities of applied sciences) | UNI | 1861492196 |
| Paid Impact Programmes | Paid side jobs, working-student roles, traineeships and job boards | PAID | 1646247199 |

When it could go in two tabs, pick by how the student engages with it, not by topic. Paid work goes to Paid Impact Programmes even if it is a competition; a challenge with prize money is not paid work.

The sheet IDs are needed for writing. If a write fails because a sheet ID is wrong, look the IDs up again with `get_spreadsheet` (fields `sheets.properties`).

## Steps

1. **Read the page.** Fetch the URL. If the key facts are missing, also fetch the obvious subpages — FAQ, registration, about, timeline. Do not fill gaps from general knowledge. If the page can't be fetched and the user pastes its text instead, use that text, and say in the draft that you couldn't check the page or the URL yourself.
2. **Check that it is new.** Read column A of the target tab and columns A–C of the Catalogue (`Catalogue!A1:C`); the Catalogue lists the programmes of all six tabs. Flag it if the programme, or something overlapping, is already in either file. If the programme row already exists but has no tag row, draft only the tag row and follow the same steps for it.
3. **Read the header rows**: row 1 of the target tab and `Catalogue!A1:R1` (`get_values`). Column layouts differ per tab and change over time, so map fields to the headers that are actually there rather than to a remembered layout. The tag row is written by position, so if the Catalogue's headers are no longer the 18 columns in the table below, in that order, stop and tell the user.
4. **Find where each row goes.**
   - Programme row: find the last filled row in column A of the target tab. Rows are not always contiguous — there are blank rows in the middle. The new row goes directly below the last filled row, never into a gap.
   - Tag row: in column A of the Catalogue, find the highest ID with the tab's prefix, for example `IDP-30` in row 31. The new ID is that number plus one, with at least two digits (`IDP-31`), and the new row goes directly below that row (row 32). Never fill a gap in the numbering.
5. **Draft both rows in chat and stop.** First check them against "Before you show the draft". Then show, in one message:
   - the programme row as a table (header | value), with its tab and row number;
   - the tag row as a table (column | value), with its row number;
   - anything you flagged.

   Ask for one approval that covers both rows. If the user changes one row, also change the other where it is affected (a new name goes in both), and show the changed rows again. Skip the approval only when the user explicitly says to add it without showing a draft; "can you add this?" still gets a draft.
6. **Write both rows**, the programme row first, as described in "Writing the rows". The approval may come long after the draft, so first read column A of the target tab and `Catalogue!A1:C` again. If someone added rows in the meantime, use the new row numbers and the next free ID, and tell the user when the ID changed.
7. **Read both rows back**, compare them with the approved draft, and check the Catalogue's filter (see "Writing the rows").
8. **Report** both row numbers with links (`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_ID&range=A33`), and say that the student guide picks the programme up at its next hourly sync. Mention that the programme row does not inherit the formatting of the row above, so borders and text wrapping may need a check. The tag row copies the formatting of the row above it.

## Field conventions: the programme row

The header rows on 9 November 2026 (always read row 1 again, see step 3):

- Impact Driven Programmes: Programme Name, Description, Sign up date, Duration, Language, Experience level, URL, Location, Costs, Interest, one-liner, Partner (yes/no), Sign-up deadline, other notes.
- Paid Impact Programmes: the same, without other notes.
- Volunteer work, Youth Organizations and Programs from other university: Programme Name, Description, Sign up date, Duration, Language, Experience level, URL, Location, Costs, Partner (yes/no).
- Summer School Programmes: Programme Name, Host university/institution, Description, Sign up date /moment, Duration, Language, Experience level, URL, Location, Costs, Specific field of interest, Partner (yes/no).

- **Programme Name** — the name the organisation uses, at most 200 characters, following the tab's pattern where it has one (minors in Programs from other university: "Name (minor, University)"). The tag row copies it exactly. No other row in the same tab may have the same name, not even with different capitals or spaces.
- **Description** — one paragraph of three to five sentences, in English. Cover only what a student needs in order to decide: what it is and who runs it, what a participant actually does, who can join, and any catch (first edition, Dutch-only, hard to get into, uncertain whether it still runs). Deadlines, duration, level, location and costs each have their own column — do not repeat them here. Leave out sponsor and partner lists, marketing claims, and background about the organisation that does not change the decision. Before writing, compare the draft against complete rows in the same tab (not the near-empty ones): if it is visibly longer, cut it.
- **Sign up date** (Summer School: Sign up date /moment) — the real deadline or rhythm as stated: "Register before 23 November 2026", "Throughout the year", "Applications open in February". Never invent one; leave it empty if the page does not say.
- **Duration** — period plus the weekly load where known: "4 months, at least 8 hours/week".
- **Language** — English, Dutch, or Dutch/English. Note when A2 Dutch or fluency is required.
- **Experience level** — 1 (any bachelor student), 2 (second year and up, some experience), 3 (advanced bachelor or master), 4 (master, PhD or professional). A range like `1-2` is fine.
- **URL** — exactly one web address starting with `https://`, and nothing else in the cell: no second link, no note in brackets, no line break. Leave the cell empty when the programme has no page of its own. Anything else makes the guide leave the programme out.
- **Location** — city or country, and "International" or "Online" where that applies.
- **Costs** — `Not paid`, `Paid (...)`, a fee, or prize money. Give the full amount, not the marketing figure.
- **Interest** (Impact Driven and Paid tabs) — one or two lowercase words, like the rows above: ecology, climate, energy, water, business, finance, governance, society, development, or any.
- **one-liner** — two sentences for the website, addressed to the student in the second person, starting with a verb: what you will do, and what you get out of it. No hype, no exclamation marks. Match the tone of the existing one-liners in the tab.
- **Partner (yes/no)** — `yes` for an opportunity supplied by an Impact Connect partner, `no` for anything found independently. When it isn't clear, use `no` and ask in the draft.
- **Sign-up deadline** (Impact Driven and Paid tabs) — the deadline in a few words, like the rows above: "15 Nov 2026", "Rolling (open application)", "Not announced (2026 round closed 4 Sep 2026)".
- **Host university/institution** and **Specific field of interest** (Summer School tab) — the host, and a short field like the rows above.
- **other notes** — internal; leave it empty.

Never put a private person's name, email address or phone number in any cell of either file; refer to the organisation instead.

Use "inspire" rather than "helps" in any Impact Connect framing.

## Field conventions: the tag row

The guide uses these tags to match programmes to what a student tells it, and to leave out what doesn't fit them (language, location, hours, paid or unpaid). Base every tag on the page. The columns, in order:

| Column | What to write |
|---|---|
| A · ID | The tab's prefix and the next number (step 4): `IDP-31`. |
| B · Programme name | Exactly the Programme Name of the programme row. |
| C · Source tab | Exactly the tab name, for example `Impact Driven Programmes`. |
| D · Type | One type from the list below. |
| E · Main field | One field from the list below: the programme's main theme. For a close call, the niche lists in column D of "Fields and roles" help. |
| F · Other fields | Up to two more fields from the same list, separated by commas, when the programme clearly crosses themes. Otherwise empty. Never the main field again. |
| G · Specific topics | Three to five concrete topics, lowercase, separated by commas: `rewilding, gis, offshore wind`. Never empty. |
| H · Ways of contributing | One or two ways from the list below, separated by a comma, the most important first. Never empty. |
| I · Skills you build | Two to four skills, lowercase, separated by commas: `pitching, teamwork, gis`. |
| J · Experience level | `1`, `2` or `3`: the programme row's level, with 4 counted as 3, and a range counted as its lowest level (`1-2` becomes 1). |
| K · Hours per week | Short text like the rows above: hours per week as a number or range (`8`, `10-15`), `flexible`, `varies`, or full-time with its length (`full-time (2 weeks)`, `full-time (5 months)`). Empty when the page doesn't say. |
| L · Costs | One value from the list below. |
| M · Language | One value from the list below: the language a student needs. |
| N · Location | One value from the list below. |
| O · Deadline status | One value from the list below, as of today. |
| P · Next deadline | Only when a concrete upcoming date is known: the first sign-up deadline a student has to meet, as `YYYY-MM-DD` (`2026-11-16`). Otherwise empty. |
| Q · Good fit for | One sentence on who this suits, based on the page: "Students who want to design tech solutions for biodiversity in a team." |
| R · Data to check | Empty, unless something in the source needs the team's attention: a contradiction on the page, doubt whether it still runs or whether Utrecht students can join, costs that aren't published. Never personal details. |

A topic or skill may not contain a comma (commas separate them) and must be shorter than 80 characters.

### The allowed values

These are the values the guide's sync accepts, from `supabase/functions/sync/vocabulary.ts` in the impact-connect-guide repository (9 November 2026). Write them exactly as shown; any other value leaves the programme out of the guide. When the team adds a value to that file, add it here too.

- **Type:** `Fellowship / programme`, `Network / community`, `Course / training`, `Student consultancy`, `Paid job / traineeship`, `Competition / challenge`, `Volunteering`, `Youth organisation`, `Summer school`, `Minor / exchange`. Usually: Volunteer work → `Volunteering`; Youth Organizations → `Youth organisation` (`Network / community` for a looser network); Summer School Programmes → `Summer school`; Programs from other university → `Minor / exchange`; Paid Impact Programmes → `Paid job / traineeship`.
- **Fields** (Main field and Other fields): `Climate & Energy`, `Nature & Biodiversity`, `Water & Oceans`, `Food & Agriculture`, `Circular Economy & Materials`, `Cities & Built Environment`, `Sustainable Business & Finance`, `Policy & Governance`, `Social Justice & Inclusion`, `International Development`, `Health & Wellbeing`, `Education, Activism & Engagement`, `Personal & Career Development` (general skills and career programmes without a sustainability theme).
- **Ways of contributing:** `Research & Analysis`, `Policy & Advocacy`, `Entrepreneurship & Innovation`, `Consulting & Strategy`, `Hands-on & Fieldwork`, `Campaigning & Community`, `Technical & Data`, `Communication & Education`, `Care & Social Support`.
- **Costs:** `Free`; `Costs money` (the student pays to take part: tuition, a programme or membership fee); `Paid` (the student earns money: a salary, stipend or allowance); `Free (prize money)` (free to join, with prize money to win). Travel or accommodation costs alone don't make it `Costs money`: tag it `Free` and give those costs in the programme row's Costs.
- **Language:** `English`; `Dutch` (Dutch is needed); `English and Dutch` (a student can take part in either language).
- **Location:** `Utrecht`; `Netherlands` (elsewhere in the Netherlands, or several places); `Online` (can be done completely online); `Netherlands and online`; `International` (abroad, or with travel abroad).
- **Deadline status:** `Open` (sign-up is open now); `Rolling` (you can join or apply at any time); `Closed` (sign-up isn't open now, and the page says when the next round is, such as "applications open in February"); `Not announced` (sign-up isn't open now, and the next round's dates aren't published); `Unknown` (the page doesn't say). Whatever the status, put the closing date in Next deadline when the page gives one.
- **Experience level:** `1`, `2`, `3`.

### Before you show the draft

Check both rows against these rules. They are what the sync checks: a programme that breaks one is left out of the guide.

- The ID looks like `IDP-31` and is not yet in column A of the Catalogue.
- The programme name is identical in both rows. No other row in that tab of the Programmes Database has the same name, and no other Catalogue row has the same source tab and name (capitals and extra spaces don't count as a difference).
- Type, Main field, Costs, Language, Location and Deadline status each hold exactly one allowed value.
- Other fields: at most two, all from the list, not the main field. Ways of contributing: at least one, all from the list.
- Specific topics and Good fit for are filled in.
- Experience level is 1, 2 or 3. Next deadline is empty or a real date as `YYYY-MM-DD`.
- In the programme row, the name is filled in, the URL is empty or one `https://` address with nothing else, the description is at most 5,000 characters and every other cell at most 1,000.

## Writing the rows

Write with `update_spreadsheet` and `updateCells`, with every text in a `stringValue`. Don't use `update_values` for these rows: it lets Google Sheets reinterpret the text, so for example `1-2` or `2-4` turns into a date. Each `update_spreadsheet` call is all or nothing.

If a call fails with a connection or network error, you can't tell whether it was written. Read the rows first and only then write what is missing. Never repeat the tag-row call blindly: a second row with the same ID makes the guide leave out both.

**1. The programme row.** One call on the Programmes Database. `rowIndex` counts from 0, so the number of the last filled row is also the index of the row below it: last filled row 32 → `"rowIndex": 32` → the new row is row 33.

```json
{
  "spreadsheetId": "1jIjZ15sPo5i6OIOW4dlv1kAlTT-2qObawFDdMUF4Ejc",
  "requests": [
    {"updateCells": {
      "start": {"sheetId": 1914001672, "rowIndex": 32, "columnIndex": 0},
      "fields": "userEnteredValue",
      "rows": [{"values": [
        {"userEnteredValue": {"stringValue": "the programme name"}},
        {"userEnteredValue": {"stringValue": "the description"}},
        {"userEnteredValue": {"stringValue": "the next column, and so on"}},
        {}
      ]}]
    }}
  ]
}
```

Give one cell per header, from column A, in the order of the header row. Use `{}` for an empty cell. A single experience level is a number, like in the rows above (`{"userEnteredValue": {"numberValue": 2}}`); a range like `1-2` stays text.

**2. The tag row.** One call on the Catalogue that inserts an empty row directly below the row with the highest ID of the prefix (step 4), copies that row's formatting, and fills the new row. In this example IDP-30 is in row 31, so `startIndex` and `rowIndex` are 31, `endIndex` is 32, and the new row is row 32:

```json
{
  "spreadsheetId": "162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY",
  "requests": [
    {"insertDimension": {
      "range": {"sheetId": 0, "dimension": "ROWS", "startIndex": 31, "endIndex": 32},
      "inheritFromBefore": true
    }},
    {"updateCells": {
      "start": {"sheetId": 0, "rowIndex": 31, "columnIndex": 0},
      "fields": "userEnteredValue",
      "rows": [{"values": [
        {"userEnteredValue": {"stringValue": "IDP-31"}},
        {"userEnteredValue": {"stringValue": "Example Climate Challenge"}},
        {"userEnteredValue": {"stringValue": "Impact Driven Programmes"}},
        {"userEnteredValue": {"stringValue": "Competition / challenge"}},
        {"userEnteredValue": {"stringValue": "Climate & Energy"}},
        {"userEnteredValue": {"stringValue": "Sustainable Business & Finance"}},
        {"userEnteredValue": {"stringValue": "energy transition, startups, pitching"}},
        {"userEnteredValue": {"stringValue": "Entrepreneurship & Innovation, Research & Analysis"}},
        {"userEnteredValue": {"stringValue": "pitching, teamwork, business modelling"}},
        {"userEnteredValue": {"numberValue": 1}},
        {"userEnteredValue": {"stringValue": "2-4"}},
        {"userEnteredValue": {"stringValue": "Free (prize money)"}},
        {"userEnteredValue": {"stringValue": "English"}},
        {"userEnteredValue": {"stringValue": "Netherlands"}},
        {"userEnteredValue": {"stringValue": "Open"}},
        {},
        {"userEnteredValue": {"stringValue": "Students who want to turn a climate idea into a startup pitch."}},
        {}
      ]}]
    }}
  ]
}
```

Give all 18 cells, A to R, in order. Experience level is a number, as in the other rows (`numberValue`). Use `{}` for empty cells, and leave Next deadline (column P) empty in this call.

**3. The next deadline**, only when there is one: `update_values` on that single cell, for example `Catalogue!P32`, with the date as `2026-11-16`. Here you do want Google Sheets to read it as a date: it stores a real date and shows it as `2026-11-16`, like the other deadlines.

**4. Read back** the new programme row and the new tag row with `get_values`, and compare every cell with the approved draft. The sync reads what the cells show, so this is what the guide will get. If a cell differs, or a value ended up in the wrong column, write the row again with `updateCells` only, at the same row (never insert another row), and read it back again. A deadline that shows any other way than `YYYY-MM-DD` needs the date format first: a `repeatCell` request on that cell with `"cell": {"userEnteredFormat": {"numberFormat": {"type": "DATE", "pattern": "yyyy-mm-dd"}}}` and `"fields": "userEnteredFormat.numberFormat"`, then write the date again.

**5. Check the Catalogue's filter.** Read it with `get_spreadsheet` (fields `sheets.basicFilter`). A row inserted inside the filter is covered automatically, but a row added below the last row is not (this happens for Programs from other university, the last group). If `endRowIndex` is lower than the new row number, send the filter back with `endRowIndex` set to the new row number. For example, UNI-11 inserted below UNI-10 in row 140 becomes row 141:

```json
{
  "spreadsheetId": "162TmXt5Rrkba72jf629l0WTyT5gf5haauhj6SJ3OenY",
  "requests": [
    {"setBasicFilter": {"filter": {"range": {"sheetId": 0, "startRowIndex": 0, "endRowIndex": 141, "startColumnIndex": 0, "endColumnIndex": 18}}}}
  ]
}
```

Keep everything else as read. The read leaves out `"sheetId": 0`, so add it, and copy any `sortSpecs`, `filterSpecs` or `criteria` the filter has into the request, so nobody's filter settings are lost.

If something can't be fixed, or only one row was written, tell the user exactly which row is in and which is not.

## Things to flag rather than silently resolve

- Contradictions on the source page — two different kick-off dates, a prize figure in the text that does not match the prize table. Pick the more specific one and say so in the reply. When neither is more specific, keep the page's wording and flag both.
- The programme already being in either file, or overlapping with an existing entry (an umbrella platform whose individual challenges are already listed).
- Anything suggesting the programme has ended or is dormant.
- Events, workshops and one-off sessions attached to a programme belong in the events database, not here.
- Tags that were a close call, such as two equally good main fields: say in one line which you picked and why.
- Problems you notice in other rows along the way, such as values in the wrong columns or personal details: mention them in one line, and don't fix them unasked.
