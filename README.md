# Book Club

A small web app for a group of friends to pick their next book and talk about it.

- **Vote:** everyone nominates books, then ranks them. The winner is picked by ranked-choice (instant-runoff) voting when the deadline passes.
- **Read:** each book gets a discussion thread. Reviews stay hidden until you post your own.
- **Remember:** a history of every book the club has read, with ratings.

Built with TanStack Start, React, Supabase and Tailwind.

## Run it locally

You need Node 22, pnpm and Docker.

```sh
pnpm install
cp .env.example .env.local
pnpm db:start   # local Supabase in Docker, with demo data
pnpm dev        # http://localhost:3000
```

Sign in as `dylan@example.com` with password `bookclub`. Emails (sign-up, password reset) go to Mailpit at <http://127.0.0.1:54324> instead of being sent.

Book search uses a built-in list of 12 books unless you add a Google Books API key. Try "piranesi" or "le guin".

## Tests

```sh
pnpm test       # unit tests
pnpm test:db    # database rules (pgTAP)
pnpm test:e2e   # browser tests; needs pnpm db:start
```

## More

- [Development notes](docs/DEVELOPMENT.md): demo accounts, local services, scripts, code layout
- [Deploying](docs/DEPLOY.md): hosted Supabase and Vercel setup
- [Build plan](docs/PLAN.md): the spec and the decisions behind it

## License

[MIT](LICENSE)
