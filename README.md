# Impact Connect student guide

A chat guide that helps university students discover which sustainability direction fits them, then recommends programmes, alumni and companies to test that direction.

- **What we're building and in which order:** [PLAN.md](PLAN.md)
- **How the guide talks:** [docs/conversation-design.md](docs/conversation-design.md)
- **Accounts and first-time setup:** [SETUP.md](SETUP.md)

## How it fits together

| Part | Where | What it does |
|---|---|---|
| Website | `web/`, published to GitHub Pages | Login, chat, profile, recommendations. Holds no secrets. |
| Database | `supabase/migrations/` | Tables and security rules, changed only through migration files |
| Database tests | `supabase/tests/database/` | Checks the security rules (pgTAP) |
| Server functions | `supabase/functions/` | The only place with API keys: Claude, Exa, the data sync |
| Deploy script | `scripts/deploy.mjs` | Puts migrations and functions on the test or live project |
| Data sync | `apps-script/`, runs in Impact Connect's Google account | Sends programmes, catalogue tags and alumni who gave permission from Google Sheets to the database every hour. Install guide: [apps-script/README.md](apps-script/README.md) |
| Add-programme skill | `skills/add-programme-to-database/`, saved in claude.ai | Adds a new programme to the Google Sheets: its programme row and its Catalogue tag row. See [The add-programme skill](#the-add-programme-skill). |

There are two Supabase projects: **test**, where everything is tried first, and **live**, which only students use. Their refs are in `supabase/projects.json`.

## Everyday commands

Run these in the project folder.

| Command | What it does |
|---|---|
| `npm install` | Installs everything (once, and after pulling changes) |
| `npm run dev` | Runs the website on your Mac at http://localhost:5173, connected to the test project |
| `npm test` | Runs the website tests |
| `npm run typecheck` | Checks the website code for type errors |
| `npm run test:functions` | Runs the server function, Apps Script and skill tests |
| `npm run deploy:test` | Deploys database changes and server functions to **test** |
| `npm run deploy:live` | Deploys them to **live** (asks for confirmation) |
| `npm run db:new <name>` | Creates a new, empty migration file |

The website itself deploys automatically: every push to `main` builds it against the live project and publishes it to GitHub Pages, after the tests pass.

For `npm run dev`, copy `.env.example` to `.env.local` and fill in the test project's URL and publishable key.

## Tests

Every pull request runs three sets of tests on GitHub (see the Actions tab), and they run once more after it is merged into `main`:

- **Website:** type check, unit tests and a build.
- **Server functions:** type check and Deno tests, including the Apps Script and add-programme skill tests.
- **Database:** applies all migrations to a fresh database and runs the security tests. This needs Docker, so it runs on GitHub rather than on your Mac.

## The add-programme skill

`skills/add-programme-to-database/SKILL.md` is the `add-programme-to-database` skill in claude.ai. Given a link to a programme, it reads the page, drafts the programme's row in the Programmes Database and its tag row in the Catalogue, and writes both after one approval. Edit the skill here: claude.ai only has the version that was last saved there.

The skill may only use the tag values the sync accepts, which are listed in `supabase/functions/sync/vocabulary.ts`. Two tests next to the skill check this. They run with `npm run test:functions`, so also on GitHub:

- `allowed_values_test.ts` fails when the skill's value lists or tab names differ from `vocabulary.ts`. So when you add a value to `vocabulary.ts`, add it to the skill too.
- `dry_run_test.ts` runs the Apps Script and the sync function on stand-in sheets with rows the skill wrote, and checks that they reach the guide. It doesn't read or write the real sheets.

After a change to `SKILL.md`, save the skill in claude.ai again; until then the old version stays active:

1. Zip it as `add-programme-to-database.skill`: a zip that holds `add-programme-to-database/SKILL.md` and nothing else. Ask Claude to make this file and send it to you.
2. Click **Save skill** on the file card. This replaces the skill with the same name.
