# LUMERA — storefront, backend and CRM

Python 3.11+ / FastAPI backend, SQLite database and a Next.js 15 / React 19 / TypeScript frontend. Authentication, CRM APIs, checkout, stock, private uploads, WhatsApp, email and the automation scheduler run in Python. Node.js 24+ runs the frontend and a transport-only API proxy. No n8n or separate database server is required.

## Start locally

```powershell
npm ci
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
# Only for a NEW installation. Preserve an existing .env.local.
Copy-Item .env.example .env.local
$env:PYTHON_EXECUTABLE = "$PWD\.venv\Scripts\python.exe"
npm run admin:create -- --email owner@example.com --name Owner
npm run dev
```

Open `http://localhost:3000/account`, sign in using the generated credentials, and open Business Studio. Admin credentials are generated randomly, printed once, and stored only as a salted scrypt hash in the database. There is no default password in source code. If this workspace was set up for you, `SETUP.local.md` contains the locally generated account credentials; keep it private. You can change your password on `/account`.

```powershell
npm run typecheck
npm run build
npm run test:backend
npm run test:whatsapp
npm run test:automations
npm start
npm run db:backup
```

`npm run test:backend` runs the Python regression suite against fresh temporary databases; it does not need a frontend build. `npm run test:python` also produces coverage and JUnit reports. After `npm run build`, use `npm run test:integration` to start isolated production frontend/Python servers and verify the full HTTP flow. Tests mock external providers and never send real customer messages. See [Python setup, migration and test guide](docs/PYTHON-BACKEND.md).

For local production-mode testing over HTTP, `.env.local` sets `COOKIE_SECURE=false`. For a deployed HTTPS site set `COOKIE_SECURE=true` and set `APP_URL` to the exact public origin.

## Automation Center without n8n

Open CRM → Automations to manage visual workflows, all/any conditions, drag-to-reorder actions, persistent delays, staff alerts, operations tasks, transactional email and WhatsApp handover. Four safe starter drafts are installed. Test without side effects, then publish Preview or Active versions; inspect runs and retry failed steps. See [Automation Center guide](docs/AUTOMATION-CENTER.md).

## What is connected

- **CRM overview:** customer count, open leads, active orders, recorded paid sales, overdue tasks and low-stock alerts.
- **Enquiries:** contact forms, trade enquiries, quote requests, newsletter signup and trade applications persist with references and customer links. Stages: new → contacted → qualified → quoted → won/lost. Staff can assign and add notes.
- **Customer history:** email-based deduplication; retail/trade/VIP segments; notes; enquiries, orders and tasks linked to each customer. Newsletter consent is recorded separately from other forms.
- **WhatsApp automation:** enquiry/order/purchase/refund/shipment/service/appointment/account-ready flows, consent, preview/live outbox, incoming replies, STOP/START, template drafts, signed webhooks, retries, sending hours and a bundled minute worker. Starts in preview mode; approvals and credentials can be added later. See [WhatsApp setup](docs/WHATSAPP.md) and [purchase automation / credential status](docs/PURCHASE-AUTOMATION.md).
- **Tasks:** follow-ups, repairs, custom-order coordination and appointments, with assignee, due date and status. These are task records, not full workshop costing or manufacturing jobs.
- **Products:** seeded from the original catalogue; editable prices, weight, making %, stone value, HUID/certificate number, available stock, variants, image paths and publication status. New products can be added. Storefront collections, product pages, search and featured pieces read the database.
- **Checkout:** server-calculated prices in integer paise, variant validation, transactional stock reservation, idempotent order retries and strict fulfilment transitions. Cancellation restores stock once. Product prices include configured GST; delivery is currently included. Orders use manual payment; nothing is charged online. WhatsApp updates are prepared automatically and remain in preview until enabled.
- **Trade account:** admins provision an account after reviewing an application, using its same email address. Trade users can see only their own order summaries. Trade pricing, credit limits and negotiated price lists are not implemented.
- **Documents:** trade applications upload up to four PDF/JPEG/PNG documents, 5 MB each. Content signatures are checked and documents are stored privately in the database; authenticated staff can download them. A production malware-scanning service can be added before processing untrusted documents at scale.
- **Metal rates:** admin-managed INR/g gold and INR/kg silver rates appear on the storefront, labelled as manual/indicative. No live market feed is fabricated.
- **Staff access:** admin, staff and trade roles; server-side checks on every CRM API; HttpOnly sessions; password change invalidates other sessions; audit activity; admin-only CRM export.
- **Backup:** SQLite online backup captures the database, including users, documents and orders. CRM JSON export is an analysis export and excludes credentials/documents; use database backup for recovery.

## Day-to-day management

1. Open **Products** and set actual prices or complete rate-based inputs; set real available stock. Initial stock is zero and unconfirmed prices stay blank.
2. Open **Rates** and enter approved store rates. Rate-based pricing requires weight and making %, plus stone value for diamond jewellery. Gold 14K derives from the 18K rate; silver pricing currently uses a 0.925 purity factor. Fixed product prices override the formula and include configured GST.
3. Website forms arrive under **Enquiries**; review payload and private documents, assign a staff member and move the lead to the right stage.
4. Open the customer record to view history. Add **Tasks** for calls, showroom appointments, repairs or workshop follow-ups. Due dates are entered in the browser's local timezone; displayed times use IST.
5. Review **Orders**, confirm with the customer, arrange manual payment and update payment/fulfilment status after verification. Valid sequence: pending → confirmed → processing → shipped → delivered. Cancellation is allowed before shipping.
6. Admins create staff/trade accounts under **Team**. Send credentials to recipients through your own approved channel; this app does not send invitations or emails automatically.
7. Run `npm run db:backup` regularly and copy backups to your secured backup storage. Restore by stopping the app, pointing `DATABASE_PATH` at the backup (or replacing the stopped database file), then restarting. Do not overwrite a live WAL-mode database.

Recover a forgotten admin password locally:

```powershell
npm run admin:create -- --email owner@example.com --reset
```

This requires filesystem access, resets only an existing admin and revokes its sessions.

## Configuration and deployment

See `.env.example`, [API reference](docs/API.md) and [project review + research](docs/PROJECT-REVIEW.md).

The database schema is initialised automatically (`backend/schema.sql`, schema version 3). Existing Node-created databases, scrypt passwords and hashed sessions remain compatible. The Python seed catalogue (`backend/seeds/products.json`) is inserted only when a product ID does not exist. Do not commit `data/`, `.env.local`, backups or local credentials. Product photos live under `public/images`; upload/copy your own photography there and reference `/images/...` in CRM.

Run a persistent Python service and the Next.js frontend with a writable durable disk and an absolute `DATABASE_PATH`. `npm run dev` / `npm start` start both services; Python embeds the minute scheduler. This SQLite design targets a single shop and one Python service process. Ephemeral filesystems and horizontal replicas are not supported by this deployment model. For multiple stores/replicas, migrate persistence to a shared database and shared private object storage first.

Keep a trusted reverse proxy in front of production. Enable `TRUST_PROXY=true` only if it overwrites `X-Forwarded-For`; otherwise rate limiting intentionally uses a shared client bucket. Session expiry is 8 hours. Use HTTPS, secure cookies and external backups.

## Existing storefront content

Typed copy and branding remain in `src/data/`. The Python seed catalogue lives in `backend/seeds/products.json`; subsequent catalogue edits belong in CRM. The current 3% calculation is in `backend/business.py` and the displayed breakdown in `src/data/site.ts`; keep them consistent if the store's configured treatment changes. Fill all `[BRACKETS]` with verified business details. `/gold`, `/silver`, `/diamonds` retain their collection pages.

## Services still requiring business setup

Online payments/refunds (e.g. Razorpay), email delivery, live rate-provider credentials, shipping/tracking, final business policies and deployment are not connected. WhatsApp flow is implemented in preview; actual delivery awaits Meta approval, credentials and activation. The current backend works locally with manual rates and manual payment; it is not a live payment gateway, accounting system, or complete jewellery ERP. The project review documents the remaining business modules and recommended order of work.



