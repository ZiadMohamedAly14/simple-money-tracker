# Backend mirrors another project's stack, with deliberate deviations

The API uses the same stack and conventions as a previous backend: Express 4, Mongoose, express-validator, jsonwebtoken, the `{ message, data, success }` response envelope, `AppError` plus a central error handler, and Jest. The team already knows them, so we chose this over Fastify + zod. Where another project has known weaknesses, we deviate on purpose:

- Access and refresh tokens use separate secrets and carry a type marker. Access tokens last 15 minutes and refresh tokens 90 days.
- Refresh tokens are stored hashed, expire automatically, are replaced atomically on each use, and reusing an old one revokes the whole session.
- Auth routes are rate-limited, with separate counters for codes sent and wrong guesses, and there is no hard-coded test code.
- Environment variables are checked when the server starts.
- Sign-in is a single verify step that creates the Account, with no complete-registration step.
- Money is stored as integers (ADR-0004).
- Deleting an account hard-deletes every collection immediately, instead of a 30-day soft delete that can be restored.
- Endpoint tests run against a real database (mongodb-memory-server).
