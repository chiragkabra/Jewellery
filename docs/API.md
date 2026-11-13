# Backend API

All business handlers run in Python/FastAPI (`backend/app.py`). The frontend has a transport-only catch-all proxy; it performs no business/database operations. Interactive API docs: `/api/docs`; health/runtime check: `/api/health`. Responses use JSON except private downloads. Errors have `{ "ok": false, "error": "..." }` and an appropriate HTTP status. Responses send `Cache-Control: no-store`. Mutations reject cross-origin requests. No wildcard CORS is enabled.

## Public

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/products` | Active database catalogue |
| GET | `/api/rates` | Store-managed indicative rates; `live: false` |
| POST | `/api/enquiry` | Persist contact/newsletter/trade-enquiry/trade-application/quote |
| POST | `/api/checkout` | Validate items, calculate total, check stock without reserving |
| POST | `/api/orders` | Place an unpaid manual-payment order and reserve stock |

Enquiry JSON: `{form, name, email, phone?, company?, message?, items?}`. Trade applications use `contact` as the name and require company. Newsletter needs email only. Empty `items` is valid for a general quote. Trade documents use multipart FormData: `payload` contains the JSON and up to four other fields contain the files. Ordinary JSON bodies are bounded at 64 KB; multipart at 21 MB total, each file at 5 MB. Files are PDF/JPEG/PNG with matching signatures.

Checkout item: `{slug, qty, variant?, colour?, size?}`. Quantity must be an integer from 1 through 1000. There may be 1–50 lines. Unknown/inactive products and invalid variants are rejected. Missing variant/colour/size defaults to the first configured option. Duplicate lines count together for stock checks.

Order payload: `{name,email,phone,address,items,expectedTotalPaise,requestId}`. Generate a UUID `requestId` once per checkout attempt and preserve it when retrying the same body after a network error. A matching retry returns the original reference without reserving again. Reusing that key with a different body returns 409. Submitted line prices are ignored. `expectedTotalPaise` must match the current server total. Successful public order response exposes only `{ok,reference,totalPaise}`.

## Authentication

`POST /api/auth` actions:

- `{action:"login",email,password}` establishes an 8-hour HttpOnly SameSite=Lax session.
- `{action:"logout"}` invalidates the session server-side and clears the cookie.
- `{action:"change-password",oldPassword,password}` requires a signed-in user, verifies the old password, revokes existing sessions and establishes a new one. New password: 12–128 characters.
- `{action:"create-user",name,email,password,role}` requires admin; roles are admin/staff/trade. There is no public account registration.

`GET /api/auth` returns the current user or null. `GET /api/account` requires login and returns that email's order summaries, with internal staff notes and address omitted.

## CRM (staff or admin)

`GET /api/crm/{resource}` lists records. `GET /api/crm/{resource}/{id}` reads one record. Resources: customers, enquiries, tasks, orders, products, settings. The initial single-store implementation lists all records; plan pagination and database aggregation before large imports.

`POST` creates customers/tasks/products/orders. `PATCH /api/crm/{resource}/{id}` updates a record. Enquiries originate from the public forms; they cannot be created using the staff creation API. There are no destructive delete endpoints; hide products or close/cancel business records instead.

| Resource | Writable fields |
|---|---|
| customers | name, email, phone, company, country, segment (retail/trade/vip), notes, newsletter |
| enquiries | status (new/contacted/qualified/quoted/won/lost), assignee, notes |
| tasks | title, customerId on creation, kind (follow-up/repair/custom-order/appointment), dueAt (ISO), status (open/in-progress/done), assignee, notes |
| products | slug on creation, name, description, material, category, price, stock, weightGrams, makingChargePct, stoneValue, variants, metalColours, images, active, certificateNo |
| orders | status, paymentStatus (unpaid/paid/refunded), notes; creation accepts the order fields above |
| settings/rates | gold24, gold22, gold18 (INR/g); silver999 (INR/kg); each number or null; admin only |

Products use stock at the whole-product level, shared across variants/sizes. Explicit stock changes are absolute available counts. Product prices are INR; order totals and line unit values are integer paise. Initial products are published catalogue entries but have zero stock and unconfirmed prices. The product editor accepts local `/images/...` paths and supports null pricing inputs.

Additional reads:

- `/api/crm/dashboard`: counts, paid sales and operational alerts.
- `/api/crm/audit`: 200 latest audit events.
- `/api/crm/attachments/{id}`: authenticated staff-only download; attachment disposition and nosniff header.
- `/api/crm/users`: admin-only account list, excluding hashes.
- `/api/crm/export`: admin-only JSON download of CRM records, excluding users, sessions and attachment bytes.

All business writes use prepared SQL parameters. Orders, stock reservation, cancellation and enquiry/document creation are transactional. A price/rate change does not alter existing order snapshots. No API marks an order paid automatically; staff must verify actual receipts. The JSON export is not a restorable backup. Use the SQLite backup command for full recovery.

## WhatsApp automation

See [WhatsApp API and activation guide](WHATSAPP.md). Public forms and checkout accept optional `whatsappConsent: "yes"` (or boolean true) with a valid explicit country-coded phone. Newsletter consent remains separate. Task status now also accepts `ready`; repair/custom-order tasks at that stage prepare the ready notification. Transactional WhatsApp outbox creation is committed alongside the business record. The minute dispatcher runs with the app launcher, using a secret-authenticated endpoint. Default preview mode never sends externally.

Orders now accept `carrier`, `trackingNumber` and an optional credential-free HTTPS `trackingUrl` when updated by staff. Own-account responses include these fields. First payment recording sets `paidAt` and queues one purchase confirmation (name/reference/IST date). An unpaid order cannot be marked refunded, and a cancelled order cannot receive a newly recorded payment. Dispatch updates queue current tracking details; superseded details are held. Refund status updates do not execute a payment-provider refund. New appointment slots and linked trade account provisioning also prepare messages, without embedding account passwords.

## Custom Automation Center

See [Automation Center API and operating guide](AUTOMATION-CENTER.md). The visual builder persists versioned drafts, conditions, steps, schedules, runs and action outputs. The secret-authenticated unified worker is `/api/automations/run`. Default starter workflows are disabled drafts; explicit preview/active publication controls execution. Native WhatsApp ownership prevents duplicate sends. Staff tasks/alerts are internal app records; email and WhatsApp remain subject to independent live-provider configuration.
