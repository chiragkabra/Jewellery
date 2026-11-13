# Python migration verification — 13 November 2026

| Check | Result |
|---|---|
| Isolated Python 3.11 / pinned dependency suite | **170 passed**, 0 failures |
| Production Next.js → FastAPI integration | **10 check groups passed** |
| Backend line coverage (tests excluded) | **89%** overall |
| API module / business module / workflow engine | 94% / 96% / 96% line coverage |
| SQLite and validation module | 97% line coverage |
| Isolated environment dependency check | No broken requirements |
| Frontend TypeScript check | Passed |
| Frontend production build | Passed |
| Original database migration rehearsal | 23 existing tables unchanged; integrity and foreign-key checks passed |

Regression tests cover authentication, roles, session rotation, origin protection, rate limits, bounded JSON/multipart, private uploads, pricing, concurrency/oversell prevention, idempotency, cancellations, purchase/shipping/refund flows, catalogue publication, account isolation, legacy password compatibility, rollback, workflow conditions/publication/ownership, durable delays, retries, cooldowns/expiry, IST schedules, embedded scheduler startup/shutdown, email and WhatsApp provider responses, preview gates, uncertain sends, signed webhook deduplication/status ordering, STOP/START, admin recovery, backups and credential import.

Production integration uses a separate temporary database and random local ports. It verifies runtime backend URL configuration, HttpOnly cookie forwarding, server-rendered CRM/catalogue, uploads, checkout, workflow APIs, raw signed webhook forwarding, unauthorised webhook rejection, worker authentication, API docs and logout.

The migration rehearsal opens the original database read-only, creates an online backup copy, initializes Python against that copy and compares every existing table before/after. The actual installation also retains a pre-migration source archive and SQLite backup under `backups/`. Existing credentials and business data are preserved.

Machine-readable reports: `test-results/python.xml`, `test-results/python-integration.json`, `test-results/python-migration.json`. Detailed coverage: `test-results/python-coverage/index.html`. CLI subprocesses are tested behaviorally but their subprocess statements are not included in the parent coverage measurement. 89% is measured coverage, not a claim of exhaustive coverage.

All provider tests use mock HTTP responses or preview mode. Actual customer delivery, production account/template/sender approvals and hosting are not certified by these tests. This rewrite retains the existing manual-payment and store-managed-rate business model; it does not add a payment gateway or a full jewellery ERP.
