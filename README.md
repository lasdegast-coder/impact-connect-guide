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

There are two Supabase projects: **test**, where everything is tried first, and **live**, which only students use. Their refs are in `supabase/projects.json`.

## Everyday commands

Run these in the project folder.

| Command | What it does |
|---|---|
| `npm install` | Installs everything (once, and after pulling changes) |
| `npm run dev` | Runs the website on your Mac at http://localhost:5173, connected to the test project |
| `npm test` | Runs the website tests |
| `npm run typecheck` | Checks the website code for type errors |
| `npm run test:functions` | Runs the server function tests |
| `npm run deploy:test` | Deploys database changes and server functions to **test** |
| `npm run deploy:live` | Deploys them to **live** (asks for confirmation) |
| `npm run db:new <name>` | Creates a new, empty migration file |

The website itself deploys automatically: every push to `main` builds it against the live project and publishes it to GitHub Pages, after the tests pass.

For `npm run dev`, copy `.env.example` to `.env.local` and fill in the test project's URL and publishable key.

## Tests

Every pull request runs three sets of tests on GitHub (see the Actions tab), and they run once more after it is merged into `main`:

- **Website:** type check, unit tests and a build.
- **Server functions:** type check and Deno tests.
- **Database:** applies all migrations to a fresh database and runs the security tests. This needs Docker, so it runs on GitHub rather than on your Mac.
