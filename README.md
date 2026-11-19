# Money Tracker

A simple mobile app for tracking monthly income, spending and budgets, plus a Kid Wallet where parents give children virtual money and teach them basic money habits.

All money in the app is virtual: no bank connections, no payments. It works offline first and supports English and Arabic (full right-to-left layout) from day one.

## Features (MVP)

- **Personal Budget:** set your Expected Income, split it into Category Budgets, record Income and Expenses in about three taps, and see what's Remaining each Month.
- **Kid Wallet:** parents top up a child's wallet split into Jars (Save, Spend, Give). Children record what they spend and read short Learn lessons. A child's own phone can run in Kid Mode, protected by a Parent PIN.
- **Offline sync:** everything works without internet and syncs across devices when online.
- **Passwordless sign-in:** sign in with a one-time code sent by email.

## Status

Implementation is in progress. The work is broken into tickets in [`.scratch/mvp/issues/`](.scratch/mvp/issues/).

## Development

Requires Node 22 (see `.nvmrc`).

```sh
npm install            # installs every workspace
npm run typecheck      # tsc --noEmit in every workspace
npm test               # Jest in every workspace (API tests start an in-memory MongoDB)
npm run build          # builds packages/shared and apps/api to dist/
```

API locally: copy `apps/api/.env.example` to `apps/api/.env`, start a MongoDB, then `npm run dev -w @money-tracker/api` (loads env from your shell; e.g. `set -a; . apps/api/.env; set +a` first). Sign-in code emails go to a local catcher in development: run Mailpit (`docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit`) and read the codes at http://localhost:8025.

Mobile locally: copy `apps/mobile/.env.example` to `apps/mobile/.env`, then `npm start -w @money-tracker/mobile` and open the development build on an Android device or emulator.

## Deployment

These steps are done by a human; nothing is deployed automatically.

**MongoDB Atlas (ADR-0008).** Create a new Atlas organization (not another project's), a project and an M0 cluster. Add a database user and allow Railway's egress (or `0.0.0.0/0` for M0). Copy the `mongodb+srv://` connection string. Set up a nightly `mongodump` since M0 has no backups.

**Railway.** Create a project on the Hobby plan from this repo. `railway.json` at the repo root sets the build (`npm run build -w @money-tracker/shared -w @money-tracker/api`), the start command and the `/health` health check. Set variables `NODE_ENV=production`, `MONGODB_URI=<Atlas string>` and optionally `DB_NAME` (defaults to `money-tracker`; Railway provides `PORT`), three fresh random secrets `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CODE_HASH_SECRET` (32+ characters, all different), and the email settings below. Generate a public domain.

**Resend (email, ADR-0008).** Create a Resend account (not another project's), verify a sending domain, and create an API key. On Railway set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<API key>` and `EMAIL_FROM=Money Tracker <no-reply@your-domain>`. Then request a code from the app in English and in Arabic and check both emails arrive.

**EAS (Android).** `npm i -g eas-cli`, `eas login`, then from `apps/mobile`: `eas init` (writes the project ID into `app.json`), replace `REPLACE-WITH-RAILWAY-DOMAIN` in `eas.json` with the Railway domain, and run `eas build --profile development --platform android`. Install the APK, start Metro with `npm start -w @money-tracker/mobile`, and the app should show "API: ok".

## Tech stack

| Part | Stack |
|---|---|
| Mobile | Expo, React Native, TypeScript, expo-router, expo-sqlite + Drizzle, NativeWind, i18next |
| API | Node.js, TypeScript, Express 4, Mongoose, express-validator, Jest |
| Data | MongoDB Atlas |
| Hosting | Railway (API), Resend (email) |

It's planned as an npm-workspaces monorepo:

```
apps/mobile      Expo app (Android first)
apps/api         REST API
packages/shared  domain types, money/date helpers, sync contract
```

## Docs

- [GLOSSARY.md](GLOSSARY.md): the domain vocabulary (Month, Remaining, Jar, Top-up, …). Use these terms in code and issues.
- [docs/adr/](docs/adr/): architecture decisions and why they were made.
- [docs/mvp-scope.md](docs/mvp-scope.md): what's in and out of the MVP.
- [.scratch/mvp/spec.md](.scratch/mvp/spec.md): the full MVP spec and user stories.
- [CLAUDE.md](CLAUDE.md): notes for AI coding agents working in this repo.
