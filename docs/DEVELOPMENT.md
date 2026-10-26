# Development notes

## Demo data

`pnpm db:start` and `pnpm db:reset` load `supabase/seed.sql`. Every account's password is `bookclub`:

- `dylan@example.com` owns "The Overdue Society", which has read three books and is reading a fourth.
- `jimmy@`, `adam@`, `giovanni@`, `brianna@` and `priya@example.com` are its other members.

There's a demo invite link at <http://localhost:3000/join/demo-invite-overdue>.

## Local services

| What | Where |
|---|---|
| App | <http://localhost:3000> |
| Emails (Mailpit) | <http://127.0.0.1:54324> |
| Supabase Studio | <http://127.0.0.1:54323> |

- **Google sign-in** is off locally until you add OAuth credentials to the `[auth.external.google]` block in `supabase/config.toml`.
- **Book search:** without a key, the `search-books` and `nominate` functions serve 12 built-in books. For real results, put `GOOGLE_BOOKS_API_KEY=...` in `supabase/functions/.env` and run `pnpm exec supabase functions serve`.
- **Vote deadlines:** the seed sets up the closing job, so overdue votes close within 5 minutes locally too.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on :3000 |
| `pnpm build` / `pnpm start` | Production build, and serving it |
| `pnpm typecheck` · `pnpm lint` · `pnpm check` | TypeScript, ESLint, Prettier |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:db` | Database tests (pgTAP) for access rules, triggers and functions |
| `pnpm test:e2e` | Playwright tests against a production build (needs `pnpm db:start`) |
| `pnpm db:reset` | Re-apply migrations and the seed |
| `pnpm db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |

## Layout

```
src/
  routes/       pages: /login, /join/$token, and _app/* for signed-in pages
  components/   app components; components/ui is vendored shadcn/ui
  lib/          config, Supabase clients, auth, queries, copy helpers
supabase/
  migrations/   schema, access rules (RLS) and database functions
  functions/    edge functions: search-books, nominate, close-round
                (_shared/irv.ts counts the votes; the app uses it too)
  tests/        pgTAP tests
  seed.sql      local demo data
e2e/            Playwright tests
```

Writes that touch several rows go through Postgres functions (`create_club`, `accept_invite`, `save_ballot` and so on). Reads use `supabase-js` directly, limited by RLS. `getSupabase()` returns the request's cookie-based client during server rendering and the browser client in the browser, so loaders work in both.

The app's name is a placeholder; change `APP_NAME` in `src/lib/config.ts`.
