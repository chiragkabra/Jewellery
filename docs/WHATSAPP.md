# WhatsApp automation — operating and activation guide

The complete local workflow is implemented. It starts in **Preview** mode and works before Meta business/template approval. Preview records are stored locally, never delivered to WhatsApp. The app does not automate WhatsApp Web or use a personal-account browser session.

## CRM workflow

Open **Business Studio → WhatsApp**:

- **Outbox:** preview message text, recipient, scheduled time, mode, status, attempts and failure reason. Refresh eligible blocked/failed records as a preview, cancel a pending message, or explicitly release a reviewed preview after live setup is ready.
- **Inbox:** incoming text/button/list replies from signed Meta webhooks. No attachments are downloaded automatically.
- **Rules & templates:** enable individual automations, set delays, map template names/languages, record approval confirmed in WhatsApp Manager, and export the draft approval bundle. The exported UTILITY category is a proposal; Meta determines approval/category.
- **Consent:** record an actual customer opt-in or withdrawal with its source/evidence. Website checkboxes are optional and unchecked by default. Newsletter signup and ordinary enquiry submission do not grant WhatsApp permission.
- **Connection:** inspect which server settings are present, pause/enable live delivery, and configure sending hours and throughput. Tokens and app secrets never appear in the CRM response.

## Automatic events

| Trigger | Prepared update | Schedule |
|---|---|---|
| Contact, trade enquiry/application or quote submitted | Enquiry acknowledgement | Immediately |
| Order successfully committed | Order acknowledgement | Immediately |
| Order fulfilment status changes | Latest order status; shipment includes carrier/tracking | Immediately |
| Staff records refund after a paid order | Refund status update | Immediately |
| Appointment booked / rescheduled | Appointment confirmation | Immediately |
| Admin provisions a linked trade account | Account-ready notice (no password) | Immediately |
| Staff records payment as paid | Purchase confirmation (name, order reference, IST date) | Immediately |
| Order remains unpaid and uncancelled | Payment reminder | 24 hours after order creation by default |
| Repair/custom-order task changes to **ready** | Piece/service ready | Immediately |
| Follow-up/appointment task created or rescheduled | Customer reminder | One hour before due time, or now if sooner |

Rule delays are added to these schedules and apply to newly prepared events. Default sending hours are **09:00–20:00 IST** and the default limit is **10 messages per minute**. Immediate messages prepared outside sending hours wait for the next permitted window. Processing also requires the app/worker to be running.

Repeated business events use unique keys. Website order retries do not create duplicate messages. Payment reminders are cancelled when payment is recorded or the order is cancelled. Completed service tasks cancel pending task notifications. Outdated order stages, rescheduled tasks, recipient changes, withdrawals, disabled rules and expired notifications are checked again immediately before sending. Follow-up reminders more than 24 hours after their task time are held. Messages more than seven days beyond their scheduled time cannot be released without preparing a fresh update.

An enquiry without permission/valid phone still succeeds: its message appears as **blocked**. A checked opt-in with an invalid country-coded phone produces a validation error so the customer can correct it. Examples: `+91 98765 43210` or `0091 98765 43210`; country codes are never guessed from a local 10-digit number.

## Approval preparation now

1. Review the English message drafts in CRM.
2. Use **Export drafts** to download template JSON, including parameter order and examples.
3. Create/review the corresponding templates in WhatsApp Manager. The CRM does not claim or manufacture approval.
4. Keep `WHATSAPP_MODE=preview` and live sending paused until the business account, number, templates and credentials are ready.
5. Test the full form → customer → outbox flow locally. These tests do not require a Meta account or send a customer message.

Template content in Meta must match the blueprint and positional parameters shown in CRM. The UI preview is the English blueprint; a different-language approved template must preserve parameter order and needs separate review. Changing a template mapping does not itself create or approve a Meta template.

## Activate after approval

Set the following in the deployed server environment / private `.env.local`:

```dotenv
WHATSAPP_MODE=live
WHATSAPP_ACCESS_TOKEN=<business messaging access token>
WHATSAPP_PHONE_NUMBER_ID=<registered phone number ID>
WHATSAPP_GRAPH_VERSION=<currently supported version, such as vXX.X from your Meta app>
WHATSAPP_APP_SECRET=<Meta app secret>
WHATSAPP_VERIFY_TOKEN=<your random webhook verification token>
WHATSAPP_CRON_SECRET=<32 or more random characters>
```

Use the exact public HTTPS origin in `APP_URL`. Register `https://your-domain/api/whatsapp/webhook` as the webhook callback, use the same verify token and subscribe the business account to the relevant message events. The GET verification checks the token; POST verifies `X-Hub-Signature-256` using HMAC-SHA256 over the **raw request bytes** before parsing, and ignores callbacks for a different phone-number ID.

Restart the app, then in CRM confirm each template's actual Meta approval and switch on live sending. **New eligible events** can then enter the live queue. Existing preview records remain held; adding credentials or toggling the switch never releases a historical backlog. Review/release old previews individually, and only while still relevant.

The dispatcher sends template messages to the fixed Meta Graph host. It does not send arbitrary free-form messages or marketing campaigns. Tokens stay in server environment variables. `sent` means Meta accepted the request; `delivered`/`read` require subsequent signed status webhooks.

## Scheduler and recovery

`npm run dev` and `npm start` run Next.js together with a minute worker. If no cron secret is configured, the launcher generates a random process-local secret and shares it only with its child server/worker. This supports preview locally without putting a secret in source code. For externally managed cron, configure a persistent secret.

To manage the worker separately:

```powershell
# Disable the bundled worker in the server process first.
# WHATSAPP_WORKER_ENABLED=false
npm run whatsapp:worker
npm run whatsapp:worker -- --watch
```

The worker calls `POST /api/whatsapp/run` with `Authorization: Bearer <WHATSAPP_CRON_SECRET>`. Run it each minute from your process manager or scheduler. Use `WHATSAPP_WORKER_URL` if the local listener differs from public `APP_URL`. Keep the server and worker running on the same persistent database deployment model. No Codex reminder/automation is required for the website scheduler.

Workers claim queue rows transactionally with a two-minute lease. HTTP 429 rejections get exponential backoff, bounded to five attempts. Permanent provider rejections are marked failed. A timeout, network disconnect, provider 5xx or expired lease may mean the provider accepted a message; these are marked **uncertain** and do not auto-retry. Reconcile in WhatsApp Manager first. A manual retry requires an explicit acknowledgement of duplicate-send risk and returns the record to preview. Valid signed delivery callbacks can resolve accepted messages, including callback correlation after an ambiguous send.

STOP/UNSUBSCRIBE withdraws consent for that phone and blocks pending messages. START/SUBSCRIBE records fresh permission but does not replay old blocked messages. A message already accepted/in flight cannot be recalled by the opt-out handler. Delivery/read webhooks are deduplicated and cannot downgrade a read message back to delivered/sent.

Incoming media is represented by its type; media storage, a free-form operator reply composer, campaigns and AI chatbot responses are not part of this transactional flow.

## API

| Method | Route | Access |
|---|---|---|
| GET | `/api/whatsapp/overview` | Staff/admin; safe configuration flags, settings, last 500 outbox rows, last 200 inbox messages and consent records |
| POST | `/api/whatsapp/settings` | Admin; rules/template mappings/sending controls |
| POST | `/api/whatsapp/consent` | Staff/admin; `{customerId,phone,optedIn,source}` |
| POST | `/api/whatsapp/messages/{id}` | Staff/admin cancel or retry-as-preview; only admin can `release` |
| POST | `/api/whatsapp/dispatch` | Admin; process due live messages, or report paused preview state |
| GET | `/api/whatsapp/webhook` | Meta verify-token handshake |
| POST | `/api/whatsapp/webhook` | Valid Meta raw-body signature; no staff cookie needed |
| POST | `/api/whatsapp/run` | Secret-authenticated scheduled worker |

Settings payload contains `enabled`, `quietStart`, `quietEnd`, `perMinute`, `rules` and `templates`; get the current schema from overview. Message actions are `{action:"cancel"}`, `{action:"retry"}` and `{action:"release"}`. Uncertain messages additionally require `confirmUncertain:true` after reconciliation.

Database schema version 2 adds `wa_outbox`, `wa_consents`, `wa_inbox`, `wa_webhooks` and `wa_status_events`. Existing business data is preserved. Full SQLite backups include these tables. The existing CRM JSON export does not include the WhatsApp operational tables; use a full database backup for restore.

## Verification and official references

`npm run test:whatsapp` executes the actual TypeScript service with SQLite and an injected mock provider. `npm run test:backend` tests the real HTTP routes, including subscription verification, rejected forged signatures, worker authentication, role permissions and signed STOP callbacks. Tests never send external WhatsApp messages. Actual Meta account acceptance, template approval, billing/limits, webhook delivery and recipient delivery require a later live-account test.

References consulted: [Meta's official Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api) and [Meta-hosted template parameter example](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/). The latter SDK project is archived; this app uses direct Graph HTTP requests, not that SDK. Choose the supported Graph version from the active app dashboard at activation time.

For the imported credential check, supplied sample purchase template, test-number restrictions and expanded purchase/service flows, see [Purchase automation](PURCHASE-AUTOMATION.md).

