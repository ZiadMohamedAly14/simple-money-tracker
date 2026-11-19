# Money Tracker

A simple mobile app for tracking monthly income, spending and budgets, plus a Kid Wallet where parents give children virtual money and teach them basic money habits.

All money in the app is virtual: no bank connections, no payments. It works offline first and supports English and Arabic (full right-to-left layout) from day one.

## Features (MVP)

- **Personal Budget:** set your Expected Income, split it into Category Budgets, record Income and Expenses in about three taps, and see what's Remaining each Month.
- **Kid Wallet:** parents top up a child's wallet split into Jars (Save, Spend, Give). Children record what they spend and read short Learn lessons. A child's own phone can run in Kid Mode, protected by a Parent PIN.
- **Offline sync:** everything works without internet and syncs across devices when online.
- **Passwordless sign-in:** sign in with a one-time code sent by email.

## Status

Planning is done and implementation hasn't started yet. The work is broken into tickets in [`.scratch/mvp/issues/`](.scratch/mvp/issues/), starting with `01-walking-skeleton`.

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
