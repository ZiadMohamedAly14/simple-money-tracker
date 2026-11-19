# 01: Walking skeleton

**What to build:** The minimum end-to-end path. An Expo development build on Android calls the deployed API's health endpoint and shows "API: ok". This sets up the monorepo (mobile app, API, shared package), CI and hosting that every later ticket builds on.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] npm-workspaces monorepo with the mobile app, the API and the shared package. TypeScript strict everywhere; the shared package has no React Native or Node dependencies.
- [ ] The API follows another project's conventions (ADR-0005): middleware order, the `{ message, data, success }` envelope, `AppError` plus a central error handler, environment variables checked at start-up, and a Mongo connection.
- [ ] The API is deployed to Railway and connected to an Atlas M0 cluster in a new organization separate from another project (ADR-0008).
- [ ] An Expo development client builds for Android through EAS and shows the health result.
- [ ] CI runs type checks and Jest tests for all workspaces; a sample shared unit test (Seam C) passes.
