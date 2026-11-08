# Impact Connect student guide

A chat guide that helps university students (Dutch and English) discover which sustainability direction fits them, then recommends programmes, alumni and companies. Scope and phases: `PLAN.md`. How the guide talks: `docs/conversation-design.md`. Commands and structure: `README.md`.

The person maintaining this is not a professional developer. Explain changes plainly, keep the stack small, and prefer one clear way of doing things over clever abstractions.

## Architecture

- `web/`: React + Vite + TypeScript, published to GitHub Pages by `.github/workflows/deploy-website.yml`. Browser config is only the Supabase URL and publishable key (`web/src/config.ts`).
- `supabase/migrations/`: the database schema. `supabase/tests/database/`: pgTAP tests, run in GitHub Actions (they need Docker; the maintainer's Mac has none).
- `supabase/functions/`: Edge Functions (Deno + TypeScript). Keep request handling in a `handler.ts` that tests can call directly, with `index.ts` only wiring it to `Deno.serve`. Shared code goes in `supabase/functions/_shared/`.
- Two Supabase projects, test and live, with refs in `supabase/projects.json`. `scripts/deploy.mjs` deploys migrations, functions and the `APP_ENV` secret to one of them.
- Google Sheets stay the source of truth for programmes, catalogue tags and alumni. An Apps Script in Impact Connect's Google account pushes only allowed columns to the app.

## Rules

- **Quality over speed.** A phase in `PLAN.md` is finished when its "done when" checks pass.
- **No secrets in the repository**, ever. Server secrets live in Supabase (Edge Functions → Secrets). Don't ask the maintainer to paste keys or passwords into the chat.
- **Database changes only through new migration files** (`npm run db:new <name>`). Never edit a migration that has been applied; never change the live database by hand.
- **Every new table gets row level security in the migration that creates it**, plus pgTAP tests for who can and cannot read or change it. Use `public.is_staff()` for staff-only access.
- **Test before live.** Deploy to test, check it, then deploy to live.
- **Alumni phone numbers and email addresses are never stored, sent to the AI or shown.** Only alumni who gave permission are imported.
- **Recommendations:** only items that exist and pass the student's hard filters (language, location, hours, paid/unpaid, avoid list). Why-lines may only use what the student actually said. Both are checked in code, not left to the model.
- **The guide never sends anything on a student's behalf.** Alumni requests go out only when the student clicks.
- **Changes to the guide's instructions must pass the conversation test set** (bar: 90% overall, 100% on safety and honesty) before going live.
- **UI text in Dutch and English.**

## Before you finish a change

Run `npm run typecheck`, `npm test`, `npm run check:functions` and `npm run test:functions`. If you changed migrations or database tests, say that the database tests only run on GitHub and check the Actions result after pushing.
