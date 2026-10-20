# Book Club: build plan

Built from the handoff spec (`book-club-spec.md`) and the canvas "Book Club — Pages & Flows" (18 mobile screens, 390×844). The spec wins wherever the two disagree. Every disagreement I found is listed under **Decisions needed** so it gets settled before the screen that depends on it is built.

---

## 0. Decisions needed

These block specific work, so each one is tagged with the phase it blocks. Each has a recommended default. I'll go with the default unless you say otherwise.

| # | Question | Recommended default | Blocks |
|---|---|---|---|
| D1 | **Hosting for TanStack Start.** The spec gives a subdomain but no host. | Vercel (first-class TanStack Start/Nitro preset, preview deploys per PR). Cloudflare Workers is the cheaper alternative. | P1 |
| D2 | **App name / subdomain.** Deferred per the spec. | `APP_NAME="Book Club"`, `APP_URL` from env. Pick the subdomain before Google OAuth setup, since the OAuth consent screen and redirect URIs need it. | P1 (OAuth) |
| D3 | **A ballot with only one rankable book.** "Your first drag casts it" doesn't work when there's nothing to drag (two nominations, one of them yours). | Single-row ballot: tapping the row counts it ("Tap to vote for this"). This is the only exception to the no-button rule. | P3 |
| D4 | **Anyone can cast a ballot that keeps the default order** only by dragging something and dragging it back. | Accept it. It's what the spec says. Revisit if friends complain. | P3 |
| D5 | **Start-vote screen in the mockup has a "Note to the club" field, an email preview, and "Start voting & notify 5 members".** Email notifications are phase 6, and there's no `note` column. | Add `rounds.note text` now and show the note on the ballot header and club home. Hide the email preview, and label the CTA "Start voting" until phase 6 ships notifications. | P3 |
| D6 | **Nominate search results show "Already nominated by Priya"**, which leaks the nominator during an anonymous vote. | Show "Already nominated" with no name while the vote is anonymous and open. The data comes from the same anonymity-safe view. | P2 |
| D7 | **What does someone who hasn't finished see on the Reviews tab?** The mockup only shows the "finished" state. | Locked state: average and "4 of 6 finished" are visible, the review bodies aren't, plus a "Finished it? Post your review" CTA. (The average leaks a little information, but it's on the book page anyway per spec.) | P4 |
| D8 | **Reviews copy uses a gendered pronoun** ("Her review shows up here…"). We don't know members' pronouns. | "Priya is still reading. Their review shows up here when they finish." Or drop the second sentence. | P4 |
| D9 | **Members who join mid-book.** Does "everyone has reviewed" include them? | Count everyone who is a member right now. A new member delays auto-finish until they review or the next book is picked. | P4 |
| D10 | **Leaving a club / removing yourself.** The spec doesn't say. | Members and admins can leave from club settings. The owner must transfer ownership first. Their nominations, ballots, posts and reviews stay. | P1 |
| D11 | **Elimination tiebreak step 1** says "previous counting round". | Walk back through *all* earlier counts until the tie breaks, then fall back to total appearances, then the seeded random. That's the standard IRV rule, and it reduces to the spec's rule when one step back is enough. | P3 |
| D12 | **Reading-time estimate** on the book sheet. | `ceil(page_count × 1.4 min)`, matching the mockup (304 pp ≈ 7 hr). Hide it when `page_count` is missing. | P2 |
| D13 | **Default deadline** on "Pick the next book". The spec says one date picker, no presets. | Pre-fill today + 7 days. Allow only future dates. | P3 |
| D14 | **Mockup Discussion screen shows sections, a locked section, spoiler blur and "Update progress".** | v1 (P4) builds the single-thread mode plus the per-book mode toggle UI, with "Sections" disabled and labelled "Coming soon". Sections and gating land in P6 as specced. | P4 |

Smaller copy and style notes are listed in **§7 Mockup → spec reconciliation**.

### Decided while building phase 1
- **Invite tokens are stored as-is, not only as a hash.** Club settings has to show the same link again, which a hash can't do. Only the club's admins can read the token (RLS). Making a new link revokes the old one, so settings shows one link at a time.
- **Settings is admin-only** (matching the mockup note). Members leave from a "Leave club" button on club home. Admins who aren't the owner leave from settings.
- **Role rules:** the owner can promote and demote anyone. Admins can promote members and remove members, but can't demote or remove other admins.
- **The reset email goes through `/auth/callback?next=/reset-password`** (PKCE), not straight to `/reset-password`. The link has to be opened in the browser that asked for it. The page says so when it fails.
- **Deadlines show in the vote's own timezone** (the admin's), so everyone sees the date the admin picked, e.g. "Closes Fri, Oct 30", not Sat for people further east.
- **Edge functions have no npm dependencies.** `nominate` talks to PostgREST with `fetch` (`_shared/rest.ts`). That keeps cold starts fast, and the local edge runtime can't download npm packages behind this environment's proxy anyway.
- **Google Books needs an API key.** Keyless requests get a daily quota of 0. Locally, without a key, the functions serve a built-in list of 12 books (`_shared/fixtures.ts`), which the e2e tests rely on.
- **Per-user rate limiting on search is deferred.** Search requires a signed-in user, and the Google key's own quota caps cost. Add it if abuse ever shows up.
- **Your own nominations appear only in the ballot footer**, not in the list, matching the phase 3 ballot, where you can't rank them.
- **IRV lives in `supabase/functions/_shared/irv.ts`**, not `packages/irv`. The local edge runtime only mounts `supabase/functions`, so shared code has to live there. The app imports the same file through a relative path.
- **Ballots have a header row** (`ballots.first_cast_at`) alongside `ballot_rankings`, because "New since you voted" needs to know when someone first voted, and that survives reordering.
- **Closing is two database calls around the TypeScript count**: `claim_round_close` (open → closing) and `finalize_round`, both safe to repeat. A claim older than 5 minutes is retaken on the next cron run.
- **pg_cron runs every 5 minutes** and calls `close-round` through pg_net, but only when a vote is overdue. The URL and service key come from Vault (`close_round_url`, `close_round_key`). The local seed sets them; production has to set them once (see README).
- **Ties for last place show their reason** on the results page, e.g. "Knocked out second (tied, but behind in an earlier count)", alongside the spec's "(tied, but on fewer ballots)".
- **Results now link to the winning book** ("Go to <title>"). Club home's "Currently reading" card has Discussion, "I finished it" / Reviews, progress and the average.
- **Posts and reviews use RLS and column grants directly**, not RPCs. Users can only write `body` (plus the book and parent on insert). A trigger sets the author and enforces one level of replies, so nobody can post as someone else. Reviews go through `post_review`, which also marks the book finished once every current member has reviewed.
- **`club_book_summary`** gives every member the average, the count and who has finished. The rating breakdown only appears once the caller's reviews are unlocked (D7).
- **Discussion refreshes every 20 seconds** while open. Realtime posts stay in phase 6.
- **The discussion-style control is there for admins**, but "Sections" is disabled and labelled coming soon (D14).
- **shadcn/ui components were copied from the upstream GitHub source**, because the shadcn registry host is blocked in the build environment. Add new ones the same way, or with `pnpm dlx shadcn add` where it's reachable.

---

## 1. Architecture

```
bkd/
  src/                         TanStack Start app
    routes/                    file routes (see §4)
    components/ui/             shadcn/ui (generated)
    components/                app components (BookCover, Avatar, StarInput, Ballot, BookSheet…)
    lib/
      supabase/                server + browser clients (@supabase/ssr), session helpers
      queries/                 TanStack Query keys + fetchers per domain
      config.ts                APP_NAME, APP_URL
      dates.ts                 deadline helpers (end-of-day in a tz → timestamptz)
    styles/                    Tailwind entry, tokens
  packages/irv/                pure TS IRV module + Vitest tests (no deps)
  supabase/
    migrations/                SQL migrations (schema, RLS, triggers, RPCs, cron)
    functions/
      search-books/
      close-round/             imports packages/irv
      _shared/                 cors, auth, supabase admin client
    tests/                     pgTAP tests for RLS + triggers
    seed.sql                   demo club matching the mockup data
    config.toml
  docs/PLAN.md
```

- **Single repo, no monorepo tooling.** `packages/irv` is a plain folder with its own `index.ts`. The app imports it through a relative path or alias. The edge function (Deno) imports it by relative path. Both runtimes can run plain TS with no Node-only APIs, so one source file serves both.
- **Package manager:** pnpm.
- **Data access rule:** reads go through `supabase-js` under RLS, from the browser or from loaders via the SSR client. Writes that involve multiple rows or invariants go through **Postgres RPCs** (security definer, with explicit checks), not client-side multi-step writes. These are: `accept_invite`, `create_club`, `change_nomination`, `save_ballot`, `start_round`, `update_round`, `post_review`. Server functions (`createServerFn`) are kept for things that need secrets or the app origin: building invite URLs and triggering an early close.
- **Types:** `supabase gen types typescript --local > src/lib/supabase/database.types.ts` (`pnpm db:types`), as a script run after every migration. CI checks that it's up to date.

### Auth plumbing
- `@supabase/ssr` `createServerClient` in a request-scoped helper that reads and writes cookies through TanStack Start's `getCookie`/`setCookie`. The browser client is a singleton.
- `_app` layout `beforeLoad`: fetch the user (`auth.getUser()`, not `getSession()`, so the JWT is verified). If there's none, redirect to `/login?next=<current path>`.
- `/auth/callback` is a server route: `exchangeCodeForSession(code)`, then redirect to a **sanitized** `next` (same-origin relative paths only, so it can't be used as an open redirect).
- `/` is a server redirect to `/clubs` or `/login`.

---

## 2. Database

### Schema
As specced, plus:
- `rounds.number int`, the "Book N" number, assigned in `start_round` as 1 + the highest number among the club's non-cancelled rounds. Cancelling Book 4 means the next vote is Book 4 again. `unique(club_id, number) where status <> 'cancelled'`.
- `rounds.note text` (D5).
- `rounds.timezone text`, the admin's IANA zone. Kept so "change the deadline" on Manage voting can recompute end-of-day in the same zone, and for display.
- `club_books.number`, copied from the round. It shows "Book 3" on results and the all-books list.
- `nominations.updated_at`, plus `ballot_rankings.created_at`. "New since you voted" = a nomination whose `created_at`/`updated_at` is later than the user's earliest ranking row for that round, and which isn't in their ranking.
- `profiles.avatar_path` (Storage) alongside `avatar_url` (from Google). The UI picks uploaded, then Google, then initials.
- `round_results`: `tallies jsonb` holds `{ counts: [{ round: 1, votes: {nomId: n}, eliminated: nomId, tiebreak: 'prev'|'appearances'|'random' }...], finishing_order: [...], ballots: n, method: 'irv'|'single'|'random' }`.
- FKs with `on delete cascade` from nominations to ballot_rankings, so removing or changing a nomination drops it from every ballot. That's exactly the spec's "rankings that included the old book drop it".
- Indexes on every FK used in RLS (`club_members(user_id)`, `rounds(club_id,status)`, `nominations(round_id)`, `posts(club_book_id, created_at)`, `reviews(club_book_id)`).

### Integrity (DB-enforced, per spec)
| Rule | Where |
|---|---|
| One open round per club | partial unique index |
| Nominate only while open and before deadline; per-member limit | `before insert` trigger on nominations |
| `max_nominations_per_member` can't go down once anyone has nominated | trigger on rounds update |
| Can't rank your own nomination; can't write ballots after close or deadline | `before insert/update` trigger on ballot_rankings |
| Creator becomes owner | `create_club` RPC (or `after insert` trigger) |
| Exactly one owner | partial unique index `club_members(club_id) where role='owner'`; `transfer_ownership` RPC swaps roles in one transaction |
| Rating 1–10 | check constraint |
| Posts: one level of replies | trigger: `parent_id` must point to a post whose `parent_id is null`, on the same club book |

### RLS
- Helpers `is_club_member(club_id)` and `club_role(club_id)`, both `security definer stable`, `set search_path = ''`, wrapping `auth.uid()` in a subselect for plan caching.
- **Nominations and anonymity.** Revoke `select` on the base `nominations` table from `authenticated`. Expose a `nominations_public` view (`security_invoker = off`, owned by a role that bypasses RLS, with membership checked in the view's `where`) that returns `nominated_by = null` when the round is open and anonymous, **except** for the viewer's own nominations (they need to see "Your nomination"). The vote-status, activity and search "already nominated" queries all read this view. pgTAP covers it.
- **Ballots:** own rows only. `round_vote_status(round_id)` RPC returns `[{ user_id, has_voted }]` for members, with no rankings.
- **Reviews:** read your own; read others' if `exists(own review on same club_book)` or `club_books.status = 'finished'`. `club_book_review_summary(club_book_id)` RPC returns avg, count and finished/total to every member (D7), so the locked state can still show progress.
- **Invites:** admins only. `accept_invite(token)` hashes the token (sha256), checks revoked, expiry and uses, inserts the member (no-op if already a member, returning `already_member`) and increments `use_count`, all in one transaction with `for update`. A companion `invite_preview(token)` RPC (callable by `anon` too) returns club name, inviter, member count, avatars, current book and open-vote line for the Join screen, or an error code: `expired | revoked | maxed | invalid`.
- **Books:** select for `authenticated`. No insert or update grants. Inserts come only from `search-books`/`nominate` via the service role or a definer RPC.
- **Storage:** `avatars` bucket, public read, write limited to `avatars/{auth.uid()}/*`.

### Key RPCs
- `create_club(name, description) → club_id`: also creates the first invite (7 days, 20 uses, matching the Invite friends mockup copy) and returns the token once.
- `create_invite(club_id, expires_at, max_uses) → token`: the raw token is returned only here and only the hash is stored. `revoke_invite(id)`.
- `start_round(club_id, deadline_date, tz, max_noms, anonymous, note)`: computes `deadline = (deadline_date + time '23:59:59') at time zone tz`, defaults `max_noms` to the previous round's value, assigns `number`.
- `update_round(round_id, deadline_date?, max_noms?, anonymous?)` (admins).
- `nominate` (an **edge function**, not an RPC, so book data is never client-supplied): takes `round_id, google_books_id, pitch`, fetches the volume by ID from Google, upserts `books` with the service role, then inserts the nomination as the user so the triggers and RLS still apply.
- `change_nomination(nomination_id, google_books_id, pitch)`: same edge function with a `replace` param. It deletes the old nomination (which cascades out of every ballot), inserts the new one, and compacts the remaining ranks per affected ballot in one transaction.
- `save_ballot(round_id, nomination_ids uuid[])`: replaces the user's rankings atomically. The client sends the full order on each debounced drop.
- `remove_nomination(id)` (admin), `cancel_round(id)` (admin).
- `post_review(club_book_id, rating, body, goodreads_url)`: upserts, then checks whether every current member has reviewed and, if so, sets `club_books.status='finished', finished_at=now()`.

### Close and cron
- `pg_cron` every 5 min calls `select net.http_post(<fn url>/close-round, headers := {Authorization: Bearer <service key from Vault>})` for rounds where `status='open' and deadline <= now()`.
- `close-round` accepts either the service role (cron, which closes all overdue rounds) or a user JWT plus `round_id`, checking `club_role in (owner, admin)` (early close).
- Idempotent: `update rounds set status='closing' where id=$1 and status='open' returning *` acts as the lock. Runs IRV, writes `round_results`, then `status='closed'`, `winner_nomination_id`, inserts `club_books`, and marks the previous `reading` club book `finished`, all in one transaction (a Postgres function `finalize_round(round_id, result jsonb)` called by the edge function after it computes IRV). On error the status goes back to `open` so the next cron run retries.
- Cancelled when there are 0 nominations. 1 nomination wins automatically. Zero ballots means a random pick with the seed stored (`method:'random'`).

---

## 3. IRV module (`packages/irv`)

```ts
type Ballot = string[];               // nomination ids, rank order
type Input  = { nominations: string[]; ballots: Ballot[]; seed: string };
type Output = {
  method: 'single' | 'random' | 'irv';
  winner: string;
  counts: { votes: Record<string, number>; exhausted: number; eliminated?: string; tiebreak?: 'prev'|'appearances'|'random' }[];
  finishingOrder: { id: string; place: number; finalVotes: number; note: 'winner'|'runner-up'|'eliminated'; eliminatedInCount?: number; tiebreak?: string }[];
};
export function runIrv(input: Input): Output | { method: 'cancelled' };
```
- Deterministic seeded PRNG (mulberry32 over a hash of `seed`). The seed is generated in `close-round` (crypto random) and stored.
- Ignores ranked ids that aren't in `nominations` (defensive, in case a nomination was removed mid-flight).
- **Tests (Vitest), written first:** 0, 1 and 2 nominations; zero ballots, random and reproducible from the seed; outright first-count majority; a multi-round transfer; exhausted ballots shrinking the majority threshold; a 50/50 final-two tie, resolved by tiebreak; each tiebreak level hit in turn (prev count, then appearances, then random); a random tiebreak stable for the same seed; the finishing-order notes behind the results copy ("Knocked out first (tied, but on fewer ballots)"); the mockup scenario (6 ballots, Piranesi wins 4–2).
- `notesFor(output)` turns the result into the results-page copy, so the UI and tests share the wording.

---

## 4. Routes and screens

Screens map one-to-one onto the canvas artboards. Each item lists the mockup file for layout and copy.

| Route | Mockup | Notes |
|---|---|---|
| `/login` | Main | Tabs, Google, show/hide password, Forgot (inline state), magic link (inline state), "Check your inbox" (confirm / magic / reset variants). Generic "Email or password is incorrect". Unconfirmed: "Confirm your email first · Resend". Signup errors: already registered, weak password. Submit sits under the fields (auth exception). Passes `next` through every method. |
| `/reset-password` | ResetPassword | New + confirm, mismatch error, success → "Go to your clubs". Expired link → "Request a new one". |
| `/auth/callback` | — | Server route. |
| `/join/$token` | Join | `invite_preview`. Signed out: "Sign in to join", which goes to `/login?next=/join/…`. Signed in: "Join club" (fixed footer CTA) plus "Signed in as … · Switch account". Error states for expired, revoked, maxed and invalid. Already a member: "Go to club". |
| `/clubs` | Clubs | Needs you (unranked open ballots, unposted reviews on `reading` books), club cards with status chips (Voting · closes Fri / Reading X / Between books), footer CTA "Create a club". Empty state for no clubs. |
| `/clubs/new` | NewClub | Live preview card with initials. Footer "Create club", then `/c/$id/invite`. |
| `/c/$clubId/invite` | InviteFriends | Copy, Share… (`navigator.share`, falling back to copy), "Done, go to club". |
| `/c/$clubId` | Dashboard | Header club name ▾ → `/clubs`. Gear for admins. Open-vote card (Book N, deadline, nominated count, X of Y voted, avatars of voters, Nominate + Rank books), or the admin CTA "Pick the next book" when there's no vote, or a member empty state. Currently reading card (X of Y finished, Discussion, "I finished it" / "Edit your review"). Carousel of past books + "See all N". |
| `/c/$clubId/settings` | Settings | Name and description, invite link (expiry · uses, New link, Revoke, Copy/Share), members with role menus (promote/demote/remove), owner-only Transfer ownership + Delete club (typed confirmation), Leave club (D10). |
| `/c/$clubId/votes/new` | StartRound | Date picker (D13), picks each stepper (1–5), note (D5), anonymous switch, footer "Start voting". |
| `/c/$clubId/votes/$roundId` | Vote, Nominate, Results | **Open:** ballot (dnd-kit sortable with pointer, touch and keyboard sensors; live-region announcements; top-3 labels; "Backups" divider; "New since you voted" chip; "✓ Saved" chip after the first save; admin sliders icon). Translucent blurred footer: "Nominate a book", or your book + Change (+ "Nominate another (N left)"). `?nominate=1` opens the search dialog: shadcn `Command`, debounced 300 ms, `search-books`, result → BookSheet (Drawer on mobile, Dialog on desktop via a `useMediaQuery` switch) with pitch, "Nominate this book" and "Not this one". **Closed:** Results (winner card, final standings bars, random-pick copy, footer "Go to <book>"). **Cancelled:** a simple notice. |
| `/c/$clubId/votes/$roundId/manage` | ManageVote | Status (days left, nominations, X of Y voted, still to vote), settings (deadline, picks each up-only, anonymous), nominations with Remove, End early (Close now & count, which calls `close-round`; Cancel with confirm). Footer "Save changes". |
| `/c/$clubId/books` | History | Summary stats, list with dates, "how it was picked", avg rating, links to results and reviews. |
| `/c/$clubId/books/$bookId` | Discussion | Book header, Discussion/Reviews segmented nav, admin mode control (D14), thread with one level of replies, composer pinned bottom. |
| `/c/$clubId/books/$bookId/reviews` | Reviews | Avg stars + distribution, "X of Y finished", reviews (if unlocked) or the locked state (D7), "<name> is still reading" rows (D8), Open on Goodreads. |
| `/c/$clubId/books/$bookId/review` | Review | StarInput (10 half-buttons, arrow keys ±0.5, `role="radiogroup"` semantics), body, Goodreads URL, the explainer, footer "Finish & post review". Then the posted state: copy & open Goodreads (rounded-up stars), Edit review, See club reviews. |
| `/profile` | Profile | Avatar upload (Storage, client-side resize to 512 px), stats, display name (inline save), email + sign-in method, Change password (hidden when `identities` has no `email` provider), Sign out. The Goodreads and notifications cards are hidden until P6, so they don't ship as dead UI. |

### Shared components
`AppHeader` (back arrow / club name link / actions), `FooterBar` (fixed, `pb-[env(safe-area-inset-bottom)]`, holds the single primary CTA), `BookCover` (image with the colored fallback used in the mockups), `Avatar` (uploaded → Google → initials, color derived from user id), `Chip` (amber / green / gray variants), `BookSheet`, `BookSearch`, `Ballot`, `StarInput`, `StarDisplay`, `Stepper`, `ConfirmDialog`.

### Design tokens
Map the mockup into the Tailwind v4 `@theme` and the shadcn CSS variables:
- `--primary: #1F5E3B` (hover `#174A2E`), `--primary-foreground: #fff`; tinted surface `#E7F0EA`.
- Stone neutrals: background `#FAFAF9`, card `#fff`, border `#E7E5E4`, input border `#D6D3D1`, muted surface `#F0EFED`, muted text `#57534E` (this passes 4.5:1 on `#FAFAF9`; avoid stone-400 for text), foreground `#1C1917`.
- Warning chip `#FEF3C7` / `#92400E`. Star color `#92400E` on light backgrounds.
- Radius: `--radius: 10px` (buttons, inputs), cards 14px, chips full.
- Fonts via `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/inter` (self-hosted, no Google Fonts request). `font-display` utility = Bricolage 700, tracking -0.02em.
- Touch targets ≥44 px, primary buttons 48 px tall, matching the mockup.
- Dark mode: out of scope for v1 (the mockup is light only). Tokens are set up so it can be added later.

---

## 5. Phases

Each phase ends deployed to preview, with its tests green. Estimates assume one developer working with Claude.

### P1: Foundation (≈ 1 week) — done
1. Scaffold TanStack Start + TS strict + Tailwind v4 + shadcn/ui (init plus Button, Input, Label, Tabs, Card, Dialog, Drawer, Command, DropdownMenu, Switch, Calendar/Popover, Sonner). ESLint + Prettier. Vitest.
2. `config.ts` (`APP_NAME`, `APP_URL`), env schema (zod) for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `APP_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY` (only used by the server fn for early close if needed).
3. Supabase project (cloud) + local CLI config. Migrations: profiles (+ trigger from `auth.users`, name from metadata or the Google `full_name`), clubs, club_members, club_invites, helpers, RLS, `create_club`, `create_invite`, `revoke_invite`, `invite_preview`, `accept_invite`, role-change RPCs, `transfer_ownership`, `leave_club`, `delete_club`.
4. Auth: SSR clients, `_app` guard, `/login` (all states), `/auth/callback`, `/reset-password`, sign out. Supabase dashboard: Site URL, redirect URLs, Confirm email on, Google provider. Google Cloud OAuth client.
5. Screens: `/clubs` (without Needs you), `/clubs/new`, `/c/$clubId/invite`, `/join/$token`, `/c/$clubId` shell, `/c/$clubId/settings`.
6. pgTAP: membership RLS, invite edge cases (expired, revoked, maxed, already a member), single owner.
7. CI (GitHub Actions): typecheck, lint, Vitest, `supabase db start` + `supabase test db`, a gen-types diff check. Deploy previews (D1).
8. Custom SMTP (Resend) before inviting real people. The built-in sender is fine for development.

**Done when:** I can create an account three ways, create a club, share the link, and a second account can join through it from a signed-out state and land in the club.

### P2: Nominations (≈ 4 days) — done
1. `search-books` edge function: `GET volumes?q=` with the server key, `printType=books`, `maxResults=20`, normalized to `{ googleBooksId, title, authors, coverUrl (https, zoom=1), isbn13, pageCount, publishedDate, description (HTML stripped), publisher/edition }`. Rate limit per user (a simple in-memory or Postgres counter). 60 s CDN cache headers.
2. `nominate` edge function (create + replace), books upsert, triggers for limit, open round and deadline, `nominations_public` view.
3. `start_round` RPC + `/votes/new` screen (needed so a round exists to test against).
4. `BookSearch` command dialog + `BookSheet` (drawer/dialog), "Already nominated" (D6), pitch.
5. pgTAP: limit, duplicate book, closed round, anonymity view.

### P3: Voting (≈ 1.5 weeks) — done
1. `packages/irv` + tests (first).
2. Ballot: dnd-kit sortable (Pointer + Touch with a 150 ms delay so scrolling isn't hijacked, Keyboard with `sortableKeyboardCoordinates`), custom `announcements`, rows ≥56 px, drag handle plus the whole row. `save_ballot` debounced at 600 ms with optimistic TanStack Query cache and retry, and the "✓ Saved" chip. Single-row case (D3).
3. Ballot triggers (own nomination, closed, deadline). `round_vote_status`.
4. Ballot footer (nominate / change / nominate another), "New since you voted".
5. Manage voting page + `update_round`, `remove_nomination`, `cancel_round`.
6. `close-round` edge function + `finalize_round` + pg_cron/pg_net/Vault. Early close from Manage.
7. Results view (winner card, standings, random copy). Club home open-vote card + "Pick the next book" CTA.
8. Tests: IRV unit suite; pgTAP for ballot rules; an integration test that seeds a round, calls `close-round` locally twice (idempotency), and asserts one club_book.

### P4: Reading (≈ 1 week) — done
1. Club book page: header, segmented nav, admin mode control (D14), posts + one-level replies, composer, edit/delete own post (admins can delete any post, for moderation).
2. Review page: StarInput (with keyboard and screen-reader tests via Testing Library), `post_review` with auto-finish, posted state, Goodreads copy & open (`navigator.clipboard.writeText`, then `window.open(goodreads isbn url)`; fall back to a title search URL when there's no ISBN).
3. Reviews page: reveal rules (RLS-backed), locked state (D7), distribution, still-reading rows.
4. Average rating to one decimal in a `club_book_stats` view (avg rating/2, count, finished/total).
5. pgTAP: review visibility before and after your own review, after the book is finished; auto-finish trigger.

### P5: Books read and shell (≈ 4 days)
1. Club home carousel (scroll-snap) + "See all".
2. `/c/$clubId/books` with "how it was picked" derived from `round_results` (`Picked from N · won outright` / `after K counts` / `picked at random`).
3. Needs you on `/clubs`: one `needs_you()` RPC that returns typed items across clubs.
4. Profile: avatar upload, stats RPC, display name, password change, sign out.
5. Polish pass against every artboard: empty, loading (skeletons) and error states; 320 px width check; safe areas; focus order; Lighthouse a11y ≥ 95.

### P6: Later
Discussion sections + reading progress + spoiler blur ("Show anyway"), Goodreads CSV import (client-side parse with papaparse, matched by ISBN13 and then title+author), notifications via Resend from a cron job plus Profile switches, email invites, realtime posts (Supabase Realtime on `posts`).

---

## 6. Testing and quality
- **Unit:** IRV (exhaustive), date helpers (end-of-day across DST and zones), ballot reorder logic, Goodreads star rounding, display-name initials.
- **DB:** pgTAP for every RLS policy and trigger above. This is where the security-relevant rules (anonymity, ballot privacy, review reveal, own-nomination ban) are proven, not in the UI.
- **E2E:** Playwright on mobile viewport (390×844) for the golden path: sign up (with the confirmation link from Inbucket/Mailpit locally) → create club → join from a second context → start a vote → both nominate → both rank (drag via keyboard) → admin closes early → results → review → reviews unlock.
- **Seed:** `supabase/seed.sql` recreates the mockup's "Overdue Society" data, for local development and screenshots.

---

## 7. Mockup → spec reconciliation (minor)
- The **Dashboard** open-vote card has two buttons (outline Nominate, primary Rank books). Keep them. "Nominate" deep-links to `?nominate=1`.
- **Dashboard** header: the club name with a ▾ links to `/clubs` (matches "club name goes back to /clubs"). Inner pages use the back arrow to club home.
- The **Ballot** mockup uses HTML5 drag. Replace it with dnd-kit per the spec.
- The **Profile** mockup shows "Signed in with Google" *and* Change password. Hide Change password for Google-only accounts per spec.
- **Results** subtitle "4 of 6 votes once the others were knocked out": generate it from the final count.
- **History** "Picked from 5 · won outright": generate it from `round_results`.
- **Start round** stepper caps picks each at 5. Keep 5 as the max in the RPC too.
- **Invite friends** copy "Works for 7 days and up to 20 people": these are the defaults for the auto-created invite. The copy reads from the invite row.
- "Book 4" numbering on Nominate, Vote and Manage comes from `rounds.number`.
- Every screen has exactly one filled primary button. Audit this in the P5 polish pass. (The mockup's Discussion screen uses a filled send button, which counts as the screen's primary action.)

## 8. Risks
- **dnd-kit on iOS Safari**: touch delay vs. scroll. Prototype the ballot first in P3 on a real phone.
- **The anonymity view**: one missed query path that reads base `nominations` leaks nominators. Mitigation: revoke base-table select so any such path fails loudly.
- **pg_cron → edge function auth**: keep the service key in Vault, never in migration SQL.
- **Google Books quality**: duplicate editions and missing ISBNs or covers. The details sheet exists exactly so people pick the right edition. The cover fallback handles gaps.
- **Supabase email limits** in development: switch to Resend before any real invites.
