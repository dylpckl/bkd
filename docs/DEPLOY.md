# Deploying

The app runs on Vercel with a hosted Supabase project. Do these once, in order.

## 1. Database and functions

From a machine with the Supabase CLI:

```sh
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy search-books nominate close-round
supabase secrets set GOOGLE_BOOKS_API_KEY=...   # optional; search works without it, at a low quota
```

Without the CLI, you can paste each file in `supabase/migrations` into the SQL editor, in order. Never run `supabase/seed.sql` in production, because it creates demo accounts.

## 2. Closing votes on time

A job runs every 5 minutes and closes votes whose deadline has passed. It needs two Vault secrets. Run this in the SQL editor:

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/close-round', 'close_round_url');
select vault.create_secret('<service_role key>', 'close_round_key');
```

Use the legacy `service_role` JWT (Project Settings → API Keys), not a new `sb_secret_...` key. The function compares it with its own `SUPABASE_SERVICE_ROLE_KEY` and rejects anything else.

Without this, votes only close when an admin ends them early.

## 3. Sign-in settings

In Supabase → Authentication:

- **URL Configuration:** set the Site URL to your app's address, and add `<app-url>/auth/callback**` as a redirect URL. Add your Vercel preview domain too if you want sign-in on preview builds.
- **Email:** keep "Confirm email" on. Set up custom SMTP (for example Resend) before inviting people; the built-in sender only allows a few emails an hour.
- **Google (optional):** create an OAuth client in Google Cloud. Add your app's address as an authorized origin and `https://<project-ref>.supabase.co/auth/v1/callback` as the redirect URI. Then paste the client ID and secret into Supabase.

## 4. Vercel

Set these environment variables for Production and Preview, then redeploy:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase → API Keys |
| `VITE_APP_URL` | your app's address, used in invite links and sign-in redirects |

## Later changes

After merging a change that adds a migration, run `supabase db push`. If an edge function changed, redeploy it.

## When a vote doesn't close

Check the job's recent runs (a missing Vault secret shows up as a failed run):

```sql
select * from cron.job_run_details order by start_time desc limit 10;
```

Check that the call to the function went through:

```sql
select * from net._http_response order by created desc limit 10;
```

A vote whose close keeps failing logs a warning in the Postgres logs. An admin can still close it early from Manage voting.
