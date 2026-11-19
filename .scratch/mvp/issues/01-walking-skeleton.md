# 01: Walking skeleton

**What to build:** The minimum end-to-end path. An Expo development build on Android calls the deployed API's health endpoint and shows "API: ok". This sets up the monorepo (mobile app, API, shared package), CI and hosting that every later ticket builds on.

**Blocked by:** None (can start immediately).

**Status:** ready-for-human

- [x] npm-workspaces monorepo with the mobile app, the API and the shared package. TypeScript strict everywhere; the shared package has no React Native or Node dependencies.
- [x] The API follows another project's conventions (ADR-0005): middleware order, the `{ message, data, success }` envelope, `AppError` plus a central error handler, environment variables checked at start-up, and a Mongo connection.
- [ ] The API is deployed to Railway and connected to an Atlas M0 cluster in a new organization separate from another project (ADR-0008).
- [ ] An Expo development client builds for Android through EAS and shows the health result.
- [x] CI runs type checks and Jest tests for all workspaces; a sample shared unit test (Seam C) passes.

## Comments

**Ticket 01 implementation (agent).** Built the npm-workspaces monorepo (`packages/shared`, `apps/api`, `apps/mobile`) with TypeScript strict everywhere, Jest + ts-jest in every workspace, and `.github/workflows/ci.yml` (typecheck + tests). The API follows ADR-0005: `createApp(env)` with helmet → cors → json → routes → 404 → central error handler, the `{ message, data, success }` envelope, `AppError` subclasses, env checked at start-up, a Mongoose connection, and `GET /health` (503 when the database is down). Seam A tests use supertest + mongodb-memory-server, and the shared package has a sample Seam C test. The Expo SDK 58 app (expo-router, dev client) shows "API: <result>" from `/health` and bundles with Metro. `railway.json`, `eas.json` and the README deployment steps are written, but nothing was deployed.

**Human follow-up**
- Create the Atlas organization (separate from another project), the M0 cluster, a DB user and network access; set up the nightly `mongodump`.
- Create the Railway project from the repo (it uses `railway.json`), set `NODE_ENV=production` and `MONGODB_URI`, generate a domain, and confirm `/health` returns ok.
- Run `eas init` in `apps/mobile`, put the Railway domain in `eas.json` (replace `REPLACE-WITH-RAILWAY-DOMAIN`), run `eas build --profile development --platform android`, install it on a device and confirm it shows "API: ok".
- Check that the first GitHub Actions run passes once pushed.
