# Python backend migration

The backend is Python 3.11+ with FastAPI, Uvicorn, standard-library SQLite and HTTPX. The React/Next.js storefront and CRM remain the frontend. `src/app/api/[...path]/route.ts` only forwards HTTP; `src/lib/server/python.ts` only fetches Python data for server-rendered pages. No Node database, password, checkout, workflow or provider implementation remains in the active source.

## Setup and run

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
$env:PYTHON_EXECUTABLE = "$PWD\.venv\Scripts\python.exe"
npm ci
npm run dev
```

Preserve an existing `.env.local`, `data/` directory and `SETUP.local.md`. For a new installation copy `.env.example` and run `python -m backend admin --email owner@example.com --name Owner`. Run commands from the project root. The launcher prefers a project `.venv` if present; otherwise it uses `PYTHON_EXECUTABLE` or `python`. Frontend: `http://localhost:3000`; backend: `http://127.0.0.1:8000`; API docs: `/api/docs`; health: `/api/health` (reports `backend: python`).

`backend/requirements-lock.txt` records the exact tested runtime/test dependency versions. For a fresh reproducible installation use `pip install -r backend/requirements-lock.txt`. If the local offline wheel cache is supplied under `backups/python-wheelhouse`, use `pip install --no-index --find-links=backups/python-wheelhouse -r backend/requirements-lock.txt`; the cache contains this machine's tested Windows/Python 3.11 distributions. Do not use those platform wheels on a different platform. The included cache script can recreate this cache from an interpreter that already has the tested dependencies installed.

`npm run build` followed by `npm start` starts the production frontend and Python service. `PYTHON_BACKEND_PORT` selects the Python listener; `PYTHON_BACKEND_URL` selects the frontend transport/SSR destination at runtime. They must refer to the same service. For independent services run `python -m backend serve --host 127.0.0.1 --port 8000`, then start Next directly with `node node_modules/next/dist/bin/next start`. The combined launcher owns its Python listener; do not point it at an unrelated existing service.

## Migrated behavior

| Module | Python source |
|---|---|
| Schema, storage, scrypt compatibility, transactions | `backend/core.py`, `backend/schema.sql` |
| Session authentication, role permissions, rate limits, uploads, all public/CRM routes | `backend/app.py` |
| Pricing, stock reservation, idempotent orders, cancellations, CRM mutations | `backend/business.py` |
| WhatsApp consent, rules/templates, queue, sender and delivery/STOP webhooks | `backend/messaging.py` |
| Workflow builder validation, immutable publication, conditions, delays, IST schedule, retries | `backend/workflows.py` |
| Transactional email outbox and Resend sender | `backend/mail.py` |
| Admin recovery, backups, worker and credential import/check | `backend/__main__.py`, `backend/credentials.py` |

The existing schema version 3 is retained. Tables, product/customer/order IDs, hashed session tokens and Node's scrypt format are compatible. Startup uses insert-if-missing seeds; existing data is not replaced. The backup command uses SQLite's online backup API, including WAL contents. No new password reset is required by this migration.

The current formula uses 3% GST and the original gold/silver purity factors. Keep the Python calculation and frontend display consistent when changing approved store pricing. Manual payment, shipping details and recorded refunds remain staff-managed; a payment gateway or courier API is not implied by the rewrite.

## Scheduler and provider delivery

FastAPI lifespan starts one background minute scheduler, executed in a worker thread with its own connection. It processes all workflow and channel queues. Use one Uvicorn process on a durable local disk. Disable `AUTOMATION_WORKER_ENABLED` before using external cron or `python -m backend worker --watch`. The one-shot `python -m backend worker` is also available. HTTP worker routes require a 32+ character secret.

Preview is the default for both providers. Adding credentials does not release historical previews. WhatsApp needs real opt-in, production setup, enabled sending and matching approved templates. Email needs live mode, API key and verified sender. Timeouts/ambiguous provider responses are held for reconciliation; automatic retry only handles definite rate-limit rejections. A completed workflow means its actions ran or messages were queued; it does not prove customer delivery.

## Tests

```powershell
.venv\Scripts\python.exe -m pytest backend/tests -v --junitxml=test-results/python.xml
.venv\Scripts\python.exe -m pytest backend/tests --cov=backend --cov-report=term-missing --cov-report=html:test-results/python-coverage
npm run typecheck
npm run build
npm run test:integration
```

Tests use temporary SQLite databases, synthetic users/orders and HTTPX mock providers. They cover security/roles, malformed and oversized payloads, document signatures/privacy, pricing, concurrency, cancellations, idempotency, legacy hashes/schema, workflow ownership, immutable versions, delay/cooldown/expiry, dry-runs, retries, IST schedules, email/WhatsApp preview gates, rate limits, uncertain sends, webhook signatures/deduplication/status ordering and STOP/START. CLI tests check admin recovery, backup and preview worker behavior. Production integration starts separate Next/FastAPI services on temporary ports and tests cookies, SSR catalogue/CRM, multipart uploads, checkout, workflows and signed raw webhooks through the proxy.

Reports: `test-results/python.xml`, `test-results/python-coverage/index.html`, `test-results/python-integration.json`. Coverage excludes test files. These checks do not replace live Meta/Resend acceptance and delivery verification after provider approval.

Verified migration results: [Python test report](PYTHON-TEST-REPORT.md).

## Rollback and hosting

Stop the frontend/Python worker before restoring. Retain the pre-migration source archive and SQLite backup. Restore the source and database together if rolling back after new business operations. Do not copy a live SQLite file without its WAL or replace a database while services are running. The migration keeps credentials private and does not include `.env.local` in source archives.

Expose the frontend or a trusted HTTPS reverse proxy, keep the Python listener private, set `APP_URL` to the public origin and secure cookies in production. Turn on `TRUST_PROXY` only behind a proxy that overwrites forwarding headers. SQLite remains a single-store deployment; multi-store replicas require a shared database/storage design.

Implementation references: [FastAPI lifespan testing](https://fastapi.tiangolo.com/advanced/testing-events/) and [Python SQLite transactions](https://docs.python.org/3/library/sqlite3.html).
