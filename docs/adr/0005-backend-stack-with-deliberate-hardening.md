# Backend uses a familiar Express stack, with deliberate hardening

The API uses Express 4, Mongoose, express-validator, jsonwebtoken, a `{ message, data, success }` response envelope, `AppError` plus a central error handler, and Jest. The team already knows this stack well, so we chose it over Fastify + zod. On top of the familiar conventions we harden the parts that commonly go wrong:

- Access and refresh tokens use separate secrets and carry a type marker. Access tokens last 15 minutes and refresh tokens 90 days.
- Refresh tokens are stored hashed, expire automatically, are replaced atomically on each use, and reusing an old one revokes the whole session.
- Auth routes are rate-limited, with separate counters for codes sent and wrong guesses, and there is no hard-coded test code.
- Environment variables are checked when the server starts.
- Sign-in is a single verify step that creates the Account, with no complete-registration step.
- Money is stored as integers (ADR-0004).
- Deleting an account hard-deletes every collection immediately, instead of a 30-day soft delete that can be restored.
- Endpoint tests run against a real database (mongodb-memory-server).
