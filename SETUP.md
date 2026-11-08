# Setup: accounts for Phase 0

You create these accounts; I can't create accounts or handle passwords. **Never paste an API key, secret key or database password into the chat or into the code.** Where a value is safe to share, this guide says so.

Time: about 45-60 minutes. Menu names on these sites shift a little now and then; if you can't find a setting, use the site's search for the term in quotes.

---

## 1. Anthropic API (Claude)

1. Go to **console.anthropic.com** (it may open as platform.claude.com) and sign up with your Impact Connect account.
2. If asked, create an organisation called **Impact Connect**.
3. **Billing:** add some credit. About $20-30 is plenty for building.
4. **Limits:** set a monthly spending limit, for example $50 while building. You can raise it before launch.
5. **API keys:** create two keys, named `guide-test` and `guide-live`. Save each one in your password manager straight away; you can only see a key once.

You'll add these keys to Supabase in step 2.6.

---

## 2. Supabase (two projects)

1. Go to **supabase.com** and sign up. "Continue with GitHub" is easiest.
2. Create an organisation called **Impact Connect** (free plan for now).
3. **New project:** name `guide-test`, region in Europe (Frankfurt if you can choose). Click "Generate a password" and save it in your password manager. Leave the other options as they are.
4. **New project** again: `guide-live`, same region, its own database password. Free is fine for now. Free projects pause after a week without use; if that happens, open the project and click Restore. Before launch we move this one to the paid plan, which doesn't pause and makes daily backups.
5. For **each** project, copy these two values into the chat. They're safe to share; they end up in the website anyway.
   - **Project URL** (Project Settings → Data API, or the **Connect** button at the top), looks like `https://abcdefghijklmnopqrst.supabase.co`. The part before `.supabase.co` is the project ref; I take it from there.
   - **Publishable key** (Project Settings → API Keys), starts with `sb_publishable_`. If you only see an "anon public" key, copy that one.

   Do **not** copy the secret key or the service_role key.
6. In **each** project: **Edge Functions → Secrets** → add a secret named `ANTHROPIC_API_KEY` with the matching key: the `guide-test` key in the test project, the `guide-live` key in the live project.

---

## 3. GitHub repository

1. In the GitHub account where your website lives (`lasdegast-coder`), create a new repository called **`impact-connect-guide`**. Don't add a README, .gitignore or licence; the project already has them.
   - **Public** if you're on GitHub's free plan, because there GitHub Pages only works for public repositories. That's safe: no keys are ever in the code, and the Jack & Jill research notes are kept out of the repository. Anyone can read the code and the plan, though.
   - **Private** only if you pay for GitHub (Pro or Team).
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables** tab (not the Secrets tab) → add two repository variables:
   - `VITE_SUPABASE_URL` = the **live** Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the **live** publishable key
4. Send me the repository URL.

---

## 4. On your Mac (I'll walk you through this when we get here)

In the project folder:

1. `npx supabase login` opens your browser once to connect your Supabase account.
2. `npm run deploy:test` deploys the database and server functions to the test project. If it asks for a database password, paste the `guide-test` one; nothing shows while you type or paste.
3. `npm run deploy:live` does the same for the live project, after you type `live` to confirm.

---

## Later phases (not now)

- **Phase 1:** an Apps Script in your Google account for the data sync. I'll write it; you paste it in.
- **Phase 2:** an email sender for the login emails (your own Google Workspace mail or an email service), because Supabase's built-in sender is only meant for testing.
- **Phase 4:** an Exa account for the company search.
