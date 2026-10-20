# Book Club

A web app for groups of friends to pick their next book with ranked-choice voting, then discuss and review it. The name is a placeholder: change `APP_NAME` in `src/lib/config.ts`.

- Spec and build plan: [`docs/PLAN.md`](docs/PLAN.md)
- Stack: TanStack Start (React, SSR, file routes), Supabase (Postgres, Auth, Storage), Tailwind v4 + shadcn/ui, TanStack Query

## Run it locally

You need Node 22, pnpm and Docker.

```sh
pnpm install
cp .env.example .env.local
pnpm db:start        # local Supabase in Docker; applies migrations and the demo seed
pnpm dev             # http://localhost:3000
```

Demo accounts (password `bookclub`): `dylan@example.com` owns "The Overdue Society", which has read three books and is reading a fourth. The other members are `jimmy@`, `adam@`, `giovanni@`, `brianna@` and `priya@example.com`. A demo invite link is at <http://localhost:3000/join/demo-invite-overdue>.

Sign-up, magic-link and reset emails don't go out locally. Open them in Mailpit at <http://127.0.0.1:54324>. Supabase Studio is at <http://127.0.0.1:54323>.

Google sign-in is off locally until you add OAuth credentials. See the `[auth.external.google]` block in `supabase/config.toml`.

When a vote's deadline passes, pg_cron calls `close-round` within 5 minutes; admins can also close early from Manage voting. Locally the seed sets this up, so it just works.

Book search runs through the `search-books` and `nominate` edge functions, which `supabase start` serves. Without a Google Books API key they return a built-in list of 12 books (try "le guin", "ishiguro" or "piranesi"). To get real results, put `GOOGLE_BOOKS_API_KEY=...` in `supabase/functions/.env` and run `pnpm exec supabase functions serve`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm typecheck` · `pnpm lint` · `pnpm check` | TypeScript, ESLint, Prettier |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Database tests (pgTAP) for RLS, triggers and RPCs |
| `pnpm test:e2e` | Playwright tests against a production build (needs `pnpm db:start`) |
| `pnpm db:reset` | Re-apply migrations and the seed |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |

## Layout

```
src/
  routes/            file routes: /login, /reset-password, /auth/callback, /join/$token, and _app/* (signed in)
  components/        app components; components/ui is vendored shadcn/ui
  lib/               config, Supabase clients, auth helpers, queries, copy helpers
supabase/
  migrations/        schema, RLS, RPCs
  functions/         edge functions (Deno): search-books, nominate, close-round; _shared/irv.ts is the vote counter
  tests/             pgTAP tests
  seed.sql           local demo data
e2e/                 Playwright tests
```

Writes that involve several rows or rules go through Postgres functions (`create_club`, `accept_invite`, `set_member_role`, …). Reads use `supabase-js` under RLS. `getSupabase()` returns the request's cookie-backed client during SSR and the browser client in the browser, so loaders work in both places.

## Deploying (later)

The app targets Vercel (`vercel.json`). For a hosted Supabase project:

1. Push migrations with `supabase link` and `supabase db push`. Deploy the functions with `supabase functions deploy`, and set the secret with `supabase secrets set GOOGLE_BOOKS_API_KEY=...`.
   Then let the 5-minute cron reach `close-round`. In the SQL editor, run:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/close-round', 'close_round_url');
   select vault.create_secret('<service_role key>', 'close_round_key');
   ```
2. In Supabase Auth, set the Site URL to the app origin and add redirect URLs for `<origin>/auth/callback**`. Keep "Confirm email" on.
3. Set up Google OAuth: add the authorized origin, plus the redirect URI `https://<project>.supabase.co/auth/v1/callback`.
4. Configure custom SMTP (Resend) before inviting real people.
5. In the host, set the env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_APP_URL`.
