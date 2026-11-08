# MVP build plan: Impact Connect student guide

A chat guide that helps students discover which sustainability direction fits them, then recommends **programmes, alumni and companies** to test that direction. Built by Impact Connect with Claude Code.

**Approach: a good build, not a fast one.** Every phase ends when its "done when" checks pass, not on a date. Once live, running it takes about 2-3 hours a week (section 7).

Related documents:
- `docs/conversation-design.md`: how the guide talks (the basis for its instructions)
- `research/jack-observations.md`: what we learned from testing Jack & Jill (private notes, kept out of the repository)
- Google Sheet "Programmes Catalogue for Matching Platform": tags for all 139 programmes

---

## 1. What the first version does

**In scope (MVP)**
- Student logs in with an email link (no password).
- Chat in Dutch or English, following the conversation design: quick start, reflection, summary.
- A visible, editable **student profile**: story, up to three directions (field + niche + way of contributing), things to avoid, practical constraints. Downloadable as PDF.
- **Recommendations per direction:** up to 3 programmes, 1-2 alumni (only with consent), 3 companies, each with an honest "why this fits you" line.
- **Alumni conversation request** handed to Impact Connect's existing alumni-linking system (website form → Google Apps Script → sheet), so the current intro, follow-up and rating keep working. Contact details are never shown.
- **Company search:** first the saved list, then a live search with fixed limits when a niche isn't covered; new finds are saved for staff review.
- The student can come back anytime to continue or change the profile, and can download or delete their data.
- **Staff view:** read full conversations (pilot phase), see what gets recommended most, review new companies. Built with summaries and flags so it fits in 2-3 hours a week (section 7).

**Not in the first version**
- Voice (later phase)
- A company-side product like Jill
- Weekly email digests to students or automatic new matches
- Job vacancies
- Formal privacy review with university partners (before scaling beyond the pilot)

---

## 2. How it fits together

```
Student's browser
  └─ Website (GitHub Pages): login, chat, profile, recommendations
        │
        ▼
Supabase (EU region; a test project and a live project)
  ├─ Login (email link)
  ├─ Database: students, profiles, conversations, programmes, alumni, companies, recommendations
  └─ Server functions (the only place with API keys)
        ├─ chat ──────────► Claude API (tools: read/update profile, search programmes, alumni, companies)
        ├─ company-search ► Exa (live search with limits), Deepline later
        ├─ alumni-request ► your existing Google Apps Script (the one your website form uses)
        └─ sync ◄───────── Apps Script in your Google account: sends programmes, tags and consenting alumni
```

- **Website:** a small React app (Vite), deployed to GitHub Pages like your other sites. It never holds API keys.
- **Supabase:** database, login and server functions in one place, in an EU region. A **test project** for trying everything and a **live project** that only students use.
- **Google Sheets stay the source of truth.** An Apps Script in your Google account (its code kept in this repository) sends only the allowed columns every night and after edits. Alumni phone numbers and emails never leave Google.
- **Claude:** start the pilot on Claude Opus 5.5, then compare Sonnet 5.5 using the conversation test set (section 5) and switch only if quality holds. All AI calls go through one function, so changing model or provider is a small change.

---

## 3. Data

| Table | What's in it | Source |
|---|---|---|
| `programmes` | Name, description, URL, deadline, costs, language, location + catalogue tags (field, niche topics, way of contributing, level, hours, deadline status, good fit for) | Programmes Database + Catalogue sheet, joined on programme name |
| `alumni` | Name, studies, current and previous job, fields of interest, LinkedIn. **Only alumni who gave permission.** No phone or email | Alumni database sheet |
| `companies` | Name, website, field, niche, location, size, takes students (y/n), status (reviewed / not reviewed / rejected), how it was found | Seed batch + live searches |
| `students` | Email, language, created | Login |
| `profiles` | Story, directions, avoid list, practical constraints, open questions; every change saved as a new version | Chat |
| `conversations`, `messages` | Full transcript, plus token use and cost per message | Chat |
| `recommendations` | Student, item (programme / alumnus / company), direction, why-line, shown at, student feedback | Chat |
| `alumni_requests` | Student, suggested alumni, question, themes, sent at | Chat → sent to the existing Apps Script, which logs it in the "Alumni gelinkte personen overzicht" tab |

---

## 4. How recommendations are made

1. **Hard filters in code first:** language, location, hours, paid/unpaid, level, and anything on the student's avoid list. Closed programmes are kept but marked "for next year".
2. **Candidates to Claude:** the remaining programmes (usually 20-60), matching alumni and companies, plus the student's profile.
3. **Claude picks** up to 3 programmes, 1-2 alumni and 3 companies per direction, and writes one why-line each. The why-line may only use things the student actually said.
4. **Checked in code:** every recommended ID must exist and pass the hard filters; otherwise it's dropped.
5. **Saved and shown**, with "promising / not for me" feedback that updates the profile.

**Companies:**
- **Saved list first.** Before launch, a one-off Exa run finds about 20-30 organisations per field, and the team reviews them.
- **Live search only when a niche isn't covered**, within fixed limits: the Netherlands (or the student's preferred country), sustainability as core business, still active, takes interns or juniors, not on the exclude list. Claude checks each result against the limits, and new finds are saved as "not reviewed".
- **A daily cap on live searches** keeps costs predictable.
- **Deepline enrichment** (company size, careers page) is added in a later phase.

---

## 5. How we keep the build good

**Two environments.** Everything is built and tried in the test project first. Students only ever touch the live project. Database changes happen only through migration files in the repository, never by clicking around in the live database.

**Everything in git, everything reviewed.** A GitHub repository from day one. Each piece of work gets its own branch and pull request, is reviewed with Claude Code's code review before it goes live, and the automated tests run on every push.

**Automated tests where a mistake would hurt.**
- Recommendation filters: a student who said "Dutch only" or "no big corporates" never gets the opposite.
- Recommendation checks: no made-up IDs, no item that fails a filter.
- Sync: alumni without consent are never imported; phone numbers and emails never arrive.
- Database security: a student can never read another student's data; only staff can read transcripts.
- Profile updates: invalid or empty updates are refused.

**A conversation test set (evals).** The most important quality tool, because the conversation *is* the product.
- About 20 test scenarios based on the Jack research: undecided, niche, unrealistic demands, hurried, bored, anxious, serious distress, Dutch, sudden switch, off-topic, peer pressure, and so on.
- For each scenario, a simulated student talks to our guide, and a grader checks the conversation against the rules in `conversation-design.md`: one question per turn, reflects back, length matches the student's energy, no over-claiming, filters respected, profile doesn't record more certainty than the student has, distress handled correctly.
- It runs before every change to the guide's instructions, so an improvement in one place can't quietly break something elsewhere. Scores are kept, so we can see progress.
- Bar before real students: at least 90% of all checks pass, and **100% on safety and honesty checks**.
- Roughly $10 per full run during building.

**Real students before launch.** 5-10 students do the full conversation, followed by a short interview. We fix what they run into, run the test set again, and only then soft launch.

**Safety and privacy built in from the start,** not added later (section 9).

**Monitoring.** Errors and costs are logged per conversation and appear in the weekly digest. The live project has daily backups.

**Easy to maintain.** A README and a `CLAUDE.md` file, so every future Claude Code session knows how the system works and which rules it must follow. The guide's instructions live in one file. Programmes and fields stay in Google Sheets, where the team already works.

---

## 6. Build phases

Rough total: **100-150 hours of work**, most of it in phases 2 and 3 (conversation quality and testing). Some steps also depend on others: data fixes by the team, recruiting test students. A phase is finished when its checks pass.

### Phase 0: Foundations
- [x] **You:** create the accounts: Anthropic API (with a monthly spending limit), two Supabase projects (test and live, EU region), a GitHub repository. I'll write a step-by-step guide.
- [x] **Me:** repository structure, README and `CLAUDE.md`, first database migration with security tests, deploy script, GitHub workflows for tests and website deploy, website skeleton with a health check. Supabase and Deno tools are part of the project; nothing extra to install on your Mac.
- [x] First push to GitHub; all three test sets pass there (the database tests can only run on GitHub).
- [x] First deploy to test and live; the website on GitHub Pages shows "Connected to the live environment".

**Done when:** an empty app deploys to test and live with one command each, the tests run on every push, and no secret is in the repository.

**Status:** done on 8 November 2026. The website is at https://lasdegast-coder.github.io/impact-connect-guide/. The security rules were also checked on both real databases.

### Phase 1: Data
- [ ] Team fixes the most important rows flagged in the catalogue's "Data to check" column, and checks the auto-filled values (summer school costs, volunteering languages and locations).
- [ ] Apps Script sync that sends only allowed columns, and a receiving function that checks every value and reports problems.
- [ ] Tests for the sync, consent filtering and the absence of contact data.
- [ ] Extend the "add programme to database" skill so it also adds the tag row to the catalogue sheet.

**Done when:** all programmes and consenting alumni arrive correctly in the test project, the sync report shows no errors, and the tests pass.

### Phase 2: Conversation
- [ ] Login with email link, sent through your own email address or an email service (Supabase's built-in sender is only meant for testing).
- [ ] Chat screen: works well on phones, Dutch and English, accessible, replies appear as they're written.
- [ ] Welcome screen with consent and the line that the team can read conversations.
- [ ] Guide instructions written from `docs/conversation-design.md`.
- [ ] Profile tools: Claude can read and update the profile; every update is shown in the chat and saved as a version.
- [ ] Safety: distress handling as in the conversation design (student psychologist, 113).
- [ ] Limits: a daily message cap per student and friendly messages when something fails.
- [ ] Conversation test set and grader, version 1; improve the instructions until it passes.
- [ ] Database security tests.

**Done when:** the test set passes the bar (section 5), the security tests pass, and you've had at least three test conversations yourself that you're happy with.

### Phase 3: Recommendations and profile page
- [ ] Programme, alumni and company search tools with hard filters and checks.
- [ ] Recommendation cards with why-line and feedback buttons.
- [ ] Alumni conversation request: sent to the same Google Apps Script your website form uses, with the fields the alumni-linking tab already has (Student, E-mail student, Studie, Vraag, Thema's, Kandidaten = the 1-2 alumni the guide suggested, Voorkeur). Your existing automation does the rest. Needed first: the website form code or the Apps Script, to see the exact endpoint and field names.
- [ ] Optional: a "talk to the Impact Connect team" button using your existing conversation-request form, pre-filling "Aangeraden programma's" and "Voorgestelde alumni".
- [ ] Profile page (story, directions, experiment plan) with PDF download.
- [ ] Test set extended with recommendation checks.

**Done when:** filter and check tests pass; the test set passes, including "why-lines only use what the student said" and "filters respected"; a test alumni request arrives correctly in the alumni sheet and your automation handles it.

### Phase 4: Companies
- [ ] One-off Exa run to seed about 20-30 organisations per field, spread over several weeks so your review stays manageable.
- [ ] Live search with limits, Claude check, saved as "not reviewed", daily cap.

**Done when:** every field has a reviewed list, the niche test scenarios find relevant organisations, and the cost per search is known.

### Phase 5: Staff view, privacy and real students
- [ ] Staff page (section 7): conversation summaries and flags, most recommended items per field, company review queue, weekly digest email.
- [ ] Privacy: privacy notice, automatic deletion after the retention period, "download my data" and "delete my account".
- [ ] 5-10 real students do the full conversation and a short interview; fix what comes up; run the test set again.

**Done when:** real students rate it well (on average 4 out of 5 or higher), no serious issue is open, and a trial week of the staff routine fits in 2.5 hours.

### Phase 6: Soft launch and pilot
- [ ] 25-30 students in the first month, then about 100 a month.
- [ ] Weekly routine from section 7 (about 2.5 hours).
- [ ] After a month: decide on Sonnet vs Opus, on transcript access, and on what's next (voice, Deepline, digests).

---

## 7. Running it in 2-3 hours a week

With about 25 students a week, reading every conversation in full doesn't fit in 2-3 hours. So the staff page does the first pass:

- **A three-line summary of every conversation:** the directions found, what was recommended, how it ended.
- **Flags** for what needs your eyes: possible distress, a student who was unhappy or gave a low rating, the guide going outside its role or claiming something it shouldn't, and no good recommendation found (a gap in the database).
- **A weekly digest email:** number of students, most recommended programmes and alumni, flagged conversations, new companies to review, errors, cost so far.
- **A capped company review queue:** about 10 new companies a week at most, each already checked against the limits, so you only approve or reject.

Weekly routine:

| Task | Time |
|---|---|
| Read flagged conversations | 30 min |
| Read a random sample of 3-5 conversations | 45 min |
| Approve or reject new companies | 20 min |
| Check the digest: numbers, errors and costs | 15 min |
| Adjust the guide's instructions or fix data | 30 min |
| **Total** | **about 2.5 hours** |

**Soft launch:** start with 25-30 students in the first month instead of 100, while you can still read most conversations. Move to 100 a month once the summaries and flags prove reliable.

---

## 8. Costs (estimate for 100 students a month)

| Item | Per month |
|---|---|
| Claude API, students | about $60-80 on Opus 5.5, about $30-40 on Sonnet 5.5 |
| Claude API, test runs | roughly $10 per full test-set run (mostly during building) |
| Supabase | test project free; live project about $25 (includes daily backups) |
| Login emails | free tier of an email service, or your own Google Workspace mail |
| GitHub Pages | free |
| Exa | pay per search; low because results are saved and capped |
| Deepline | later phase |
| **Total when running** | **roughly $100-150** |

The Claude figures are estimates (about 25 chat turns, one matching step and a few follow-ups per student). The real cost per conversation is measured in phase 5.

---

## 9. Privacy and safety

- Students see before they start that the team can read conversations, and give consent.
- Alumni phone numbers and emails never leave Google; requests go through the existing flow.
- Only alumni who gave permission are recommended.
- Supabase in an EU region.
- Conversations and profiles are deleted automatically after the retention period. Students can download their data and delete their account.
- The guide recognises serious distress and refers to the student psychologist, the general practitioner, or 113 Zelfmoordpreventie (0800-0113). This is part of the test set.
- A daily message cap per student, and a monthly spending limit in the Anthropic account.
- The guide can't send anything on a student's behalf: alumni requests only go out when the student clicks the button.
- A full privacy review with partner universities comes before scaling beyond the pilot.

---

## 10. Open questions

1. **Name and look:** what is the chatbot called (the assistant students talk to), and which website's colours and logo should it follow?
2. **Launch date** for the pilot, and where students find the link (university, events, newsletter).
3. **Retention period** for conversations and profiles (for example 12 months).
4. **Deepline:** what exactly should it add, and when?
5. **Alumni request details:** the endpoint and field names of the Apps Script (needed in phase 3).
