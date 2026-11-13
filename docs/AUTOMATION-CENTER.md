# Automation Center — without n8n

The CRM includes a custom, persistent Automation Center. Open **Business Studio → Automations**. It uses the application's database and bundled worker; no n8n account/server is required.

## What you can manage

- Visual ordered-step builder: drag cards to reorder or use the up/down controls.
- Trigger selection: enquiry, order/purchase/payment, shipment/refund, appointment/service/account events, inventory below the configured threshold (default two pieces) and a daily IST schedule.
- All/any conditions on approved business fields: customer segment, order amount in INR, payment/status, stock, tracking, dates and references.
- Actions: staff alert, operations task, persistent delay, transactional email and the corresponding WhatsApp event template.
- Drafts, publication versions, Preview/Active mode, pause, duplicate, dry-run tests and recent run history with individual step results.
- Staff alert acknowledgements, operations task completion, email outbox/reconciliation and native WhatsApp rule settings.

Four starter drafts are installed: Purchase desk alert, Low stock follow-up, Daily operations check and Customer order email. They are not enabled automatically. Configure and test a draft before publication.

## Build a workflow

1. Select an installed draft, click **New workflow**, or select a starter template.
2. Pick the trigger. For a daily schedule, enter the hour/minute in IST. If today's time has already passed when published, the first scheduled event is tomorrow.
3. Add up to ten conditions and choose All/Any. For example `amount greater_than 10000`, or `segment equals vip`. Conditions with missing fields do not match, including `not_equals`.
4. Add and order up to twelve action/delay cards. Tokens use `{{customerName}}`, `{{reference}}`, `{{amount}}`, `{{productName}}`, `{{stock}}`, etc. Only listed business variables are permitted; there is no JavaScript/eval or secret/environment-variable access.
5. Choose a sample or captured event and click **Test without side effects**. It renders the plan and conditions without creating business records or sending anything. Missing variables produce a validation explanation.
6. Save the draft. It does not affect the current published version.
7. Publish in **Preview** for real event/run logging with simulated actions; or explicitly choose **Active** to create actual internal records and prepare eligible messages. External delivery also needs each channel's separate live credentials/settings.

Published preview workflows honour scheduled events and delays, but simulate their actions in run logs. The Test button renders the whole plan without waiting for delays. An unmatched test may still show the proposed step content; those steps would not execute.

## WhatsApp ownership

Existing transactional WhatsApp rules remain available under **Built-in WhatsApp** and in the WhatsApp workspace. Adding another send for the same event could duplicate a customer notification, so a custom workflow must explicitly **take over** its matching built-in rule when published.

The takeover disables that native rule and cancels pending native messages for it. The business event is still captured even when the native rule is off. One published custom WhatsApp workflow can own a trigger at a time. Custom WhatsApp actions use the matching template/parameters, not arbitrary free-form message text. Consent, test-recipient allowlists, real template approval, sending hours and all other existing delivery gates remain enforced.

Pausing a custom workflow does not silently re-enable its old native rule. To restore native behaviour, pause the custom workflow, then enable the built-in rule. If someone re-enables a native rule through the older WhatsApp settings page, custom sends are held instead of duplicating it.

## Runs, retries and versions

Business events and runs are stored with stable keys. Events captured before a workflow's publication are not replayed, even if their scheduled availability is later. Re-publishing creates a new immutable definition/version and cancels pending work from the previous version. Current drafts do not change existing run snapshots.

Conditions and relevant business state are checked when matching and before resuming the run. Paid/cancelled payment reminders, obsolete order/tracking stages, completed/rescheduled appointments and replenished inventory are skipped. New events older than seven days beyond availability are held. Planned workflow delays can be up to 30 days; an already-started run is held only when it is over seven days late for its next step. Email previews expire after seven days. Appointment reminders more than one day after the appointment are held. A per-entity cooldown can suppress repeated stock/events for the same published version.

Delays store a due time/cursor; the worker does not sleep inside a workflow. A failed step can be retried after correcting its data while the same version is active. Completed steps are not repeated. **Completed run** means its actions were performed or messages prepared; actual delivery is tracked in the channel outboxes, not inferred from run completion.

Workflow-created alerts/tasks do not recursively trigger more workflows. Staff operations tasks are deliberately separate from workshop/customer Tasks so daily/stock tasks can exist without inventing a customer. They can optionally link to the source customer.

Pausing cancels pending runs and unsent queued/preview messages. It cannot recall already accepted/in-flight messages. Email/WhatsApp uncertain outcomes require provider reconciliation before an explicitly acknowledged retry.

## Transactional email

The application uses direct [Resend Send Email HTTP requests](https://resend.com/docs/api-reference/emails/send-email), with an [Idempotency-Key](https://resend.com/docs/dashboard/emails/idempotency-keys) per email action. Provider idempotency is limited to its documented 24-hour window; local queue/run keys persist, and unknown outcomes are never blindly resent.

Configure privately, then restart:

```dotenv
EMAIL_MODE=live
RESEND_API_KEY=<verified Resend API key>
EMAIL_FROM=orders@your-verified-domain.example
EMAIL_PER_MINUTE=10
# Optional test allowlist, comma separated:
EMAIL_ALLOWED_RECIPIENTS=owner@example.com
```

Without those live settings, email actions from Active workflows enter an explicit preview outbox. Adding credentials never releases previews automatically; admins review/release individual eligible emails. Published Preview workflows simulate emails only in their run logs.

Templates are plain text, recipient is the event's customer or a validated staff email, and there are no arbitrary outbound HTTP URLs. Marketing campaigns and bulk list uploads are not implemented. `sent` means the provider accepted the email; recipient delivery/bounces are not tracked by an email webhook in this implementation.

## Scheduler and access

`npm run dev` / `npm start` launch the Python backend with an embedded minute scheduler. It directly processes workflow events, due steps and both message queues using SQLite. `/api/automations/run` remains available for secret-authenticated external cron; `/api/whatsapp/run` processes only WhatsApp.

External HTTP cron uses `AUTOMATION_CRON_SECRET`, falling back to `WHATSAPP_CRON_SECRET`; configure at least 32 characters. The embedded Python scheduler does not make HTTP calls or require a cron secret. For a separate direct database worker, disable the embedded scheduler first:

```powershell
$env:AUTOMATION_WORKER_ENABLED = "false"
python -m backend worker
python -m backend worker --watch
```

Use `AUTOMATION_WORKER_ENABLED=false` (or legacy `WHATSAPP_WORKER_ENABLED=false`) when an external scheduler owns processing. `WHATSAPP_WORKER_URL` is retired. **Connections** shows the last successful workflow check; the Python service or separate worker must stay running for schedules to execute.

Admins manage drafts/publication, ownership and email releases. Staff can inspect/test workflows, acknowledge alerts and finish operations tasks. Trade users have no Automation Center API access. Secrets are never returned in its connection overview.

## APIs and backup

- `GET /api/automations/overview`: definitions, recent runs/events, staff alerts/tasks, email outbox and safe connection/worker metadata.
- `POST /api/automations/save[/{id}]`: create/update a draft (`{definition}`).
- `POST /api/automations/publish/{id}`: publish draft (`{takeOverWhatsApp?:true}`).
- `POST /api/automations/pause/{id}` or `/duplicate/{id}`.
- `POST /api/automations/test`: pure dry run (`{definition,eventId?}`).
- `POST /api/automations/retry/{runId}`: retry the failed step of an active current version.
- `POST /api/automations/alerts/{id}`: acknowledge; `/tasks/{id}` with `{status:"open"|"done"}`.
- `POST /api/automations/native-rule`: `{event,enabled,delayMinutes}`.
- `POST /api/automations/emails/{id}`: `{action:"retry"|"release"|"cancel",confirmUncertain?:true}`.
- `POST /api/automations/process`: admin manual workflow/email processing.
- `POST /api/automations/run`: secret-authenticated full scheduled cycle.

Schema version 3 adds workflow, event, run, alert, operations-task and email tables. The online SQLite backup includes all of them. CRM JSON export is not a full automation backup. The UI shows recent records (300 runs/alerts/tasks/emails, 100 events); the full database retains history. Deploy on persistent storage as documented in the main README.

The builder supports an ordered action sequence with an all/any entry condition. Arbitrary branching graphs, custom executable code, third-party connector authoring and a general n8n clone are outside this jewellery automation system.

## Validation

Run `npm run test:automations`, `npm run test:whatsapp`, `npm run test:backend`, `npm run typecheck` and `npm run build`. Tests use isolated SQLite data and mocked providers; no actual messages are sent. Real email/WhatsApp delivery still needs the account credentials/approvals described above and in the WhatsApp guide.

