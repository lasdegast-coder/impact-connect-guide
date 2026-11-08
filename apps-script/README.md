# Data sync: Google Sheets → student guide

`Code.js` is an Apps Script that runs in Impact Connect's Google account. Every hour it sends programmes, catalogue tags and alumni who gave permission to the student guide. The guide's sync function checks every value and saves the rows that are correct. You get an email when there is something to fix.

## What it sends, and what it never sends

| Sheet | Sent | Never read or sent |
|---|---|---|
| Programmes Database (6 tabs) | Programme name, description, one-liner, URL, sign-up date, sign-up deadline, duration, location, costs, host university | Interest, Partner, other notes |
| Catalogue | ID, source tab, type, fields, topics, ways of contributing, skills, experience level, hours, costs, language, location, deadline status, next deadline, good fit for | Data to check |
| Alumni (Formulierreacties 1) | Only for alumni who answered "Yes, I give permission": form timestamp, full name, BSC, MSC, current and previous occupation, fields of interest, LinkedIn | **Phone number, Email**, contact preference, preferred frequency |

How the script decides:
- **Programmes:** a programme is sent when its catalogue row has the same source tab and programme name as a row in the Programmes Database. Capitals and extra spaces don't matter.
- **Alumni:** only alumni who answered "Yes, I give permission" are sent. If someone filled in the form more than once, only their newest response counts. A newer "no" therefore removes them from the guide.
- **Phone and email columns:** the script only reads the columns listed above, one column at a time, so it never reads these two. The guide refuses any request that contains them, and its database refuses any text that looks like an email address or phone number.

## Install (once, about 20 minutes)

The sync function has to be on the test project first: run `npm run deploy:test` after the pull requests are merged.

### 1. Make a sync secret

The secret proves to the guide that the data comes from your script.

1. In your password manager, generate a new password: **at least 40 characters, letters and digits only** (no symbols, so copying can't go wrong).
2. Save it as **"Impact Connect sync secret (test)"**.

Don't paste it into the chat.

### 2. Give the secret to the test project

1. Go to **supabase.com** → the **guide-test** project → **Edge Functions** → **Secrets**.
2. Add a secret named `SYNC_SECRET` with the secret as its value, and save.

### 3. Create the Apps Script project

1. Sign in to Google with the Impact Connect account that can open all three sheets.
2. Go to **script.google.com** → **New project**.
3. Click "Untitled project" at the top and rename it to **Impact Connect guide sync**.
4. Open [`Code.js` on GitHub](https://github.com/lasdegast-coder/impact-connect-guide/blob/main/apps-script/Code.js) and click the **Copy raw file** button (two overlapping squares, top right of the code).
5. In the Apps Script editor, select everything in `Code.gs`, delete it, and paste.
6. Save with **Ctrl+S** (Windows) or **Cmd+S** (Mac).

### 4. Settings

1. Click the gear icon (**Project Settings**) on the left.
2. Under **General settings**, set the time zone to **(GMT+01:00) Amsterdam**.
3. Scroll down to **Script Properties** → **Add script property**:
   - Property: `SYNC_SECRET_TEST`
   - Value: the secret from step 1, exactly the same as in Supabase
4. Click **Save script properties**.

### 5. First run

1. Go back to the **Editor** (the `<>` icon).
2. In the bar above the code, choose the function **`syncNow`** and click **Run**.
3. Google asks for permission:
   1. Click **Review permissions** and choose the Impact Connect account.
   2. You'll see "Google hasn't verified this app". That's normal for a script you made yourself. Click **Advanced**, then **Go to Impact Connect guide sync (unsafe)**.
   3. Google lists what the script may do:
      - **Google Sheets:** Google asks for full access, but the script only reads. A test checks that the code contains no instruction that changes a sheet.
      - **Connect to an external service:** sends the data to the guide.
      - **Send email as you:** only the problem report, to yourself.
      - **Run when you're not present:** for the hourly sync.
   4. Click **Allow**.
4. The **Execution log** at the bottom shows the report. For example:

   ```
   Impact Connect sync, 2026-11-10 14:05
   Read 139 catalogue rows, 139 programmes and 63 alumni form responses. Sent 139 programmes and 63 alumni with permission.

   test: saved 130 programmes and 63 alumni (left out: 9 programmes, 0 alumni).

   9 problems to fix in the sheets. Rows with a problem are left out until it is fixed:
   - Impact Driven Programmes row 2 (IDP-01, Externship), URL: "https://www.extern.com/externships & https://..." should be one web address without spaces or other text, or an empty cell.
   ```

5. Fix the problems in the sheets and click **Run** again. Each line names the sheet, the row and the column. For alumni, the report never repeats what someone wrote.

### 6. Start the hourly sync

When the first run worked, choose **`startHourlySync`** and click **Run** (once). From then on:
- the sync runs every hour, so edits in the sheets reach the guide within an hour;
- you get an email when the sync fails or finds problems. The same list of problems is emailed only once.

To stop it, run **`stopHourlySync`**.

## Later: the live project

When the test project looks right and `npm run deploy:live` has run:
1. Generate a **second** secret: "Impact Connect sync secret (live)".
2. Add it as `SYNC_SECRET` in the **guide-live** project (Edge Functions → Secrets).
3. Add it as `SYNC_SECRET_LIVE` in the Script Properties.

From the next run, the script sends the same data to both projects. The code stays the same.

## Updating the script

When `Code.js` changes in the repository, repeat step 3.4 to 3.6: copy, replace everything in `Code.gs`, save. The secrets and the hourly sync stay as they are.

## When something goes wrong

| The report says | What to do |
|---|---|
| `No sync secret found` | Add `SYNC_SECRET_TEST` in the Script Properties (step 4). |
| `test: FAILED. Wrong or missing sync secret.` | The secret in Supabase and in the Script Properties differ. Paste the same secret in both places again. |
| `test: FAILED. The sync is not set up yet: SYNC_SECRET ...` | Add `SYNC_SECRET` in the Supabase project (step 2). |
| `The tab "..." has no column "..."` | A column header was renamed. Rename it back, or ask for the script to be updated. Nothing was sent. |
| `Refused: this sync would remove 80 of the 139 programmes` | The guide refuses to remove more than half of the programmes at once, in case a sheet is broken. Check for a renamed tab or column. Nothing was changed in the guide. |
| `... is not one of: ...` | The value isn't one the guide knows. Use one of the listed values. If a new value is really needed (for example a new location), ask for it to be added to the guide first. |

The rules the guide checks are in `supabase/functions/sync/validate.ts`. The allowed values for the catalogue columns are in `supabase/functions/sync/vocabulary.ts`.
