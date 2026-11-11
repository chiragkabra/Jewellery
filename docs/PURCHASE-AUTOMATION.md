# Purchase and service automation update

The private credential file supplied at `D:\Jewellery\cred` has been parsed as data. The cURL in that file is never executed. A read-only Meta account request succeeded with HTTP 200 on the supplied Graph version, **v25.0**. The account identifies its number as **Test Number**. Tokens and the recipient number are not reproduced in this document.

The file contains a bearer access token, phone-number ID, Graph version, test recipient and a three-parameter sample order template: `jaspers_market_order_confirmation_v1` (`en_US`). It does **not** contain the Meta App Secret or WABA ID. Account access success does not prove template approval or production recipient delivery. The sample's real message copy/branding must be reviewed in Meta before activation; the CRM preview is the app's draft.

## Customer purchase flow

1. Customer chooses products with configured prices/stock, enters contact/delivery details and optionally grants WhatsApp permission.
2. Checkout validates prices and inventory server-side and commits one order plus its acknowledgement/reminder queue records. A network retry reuses the order and messages.
3. **Order received:** acknowledgement is prepared at placement. This is distinct from payment: current checkout collects no online funds.
4. Staff verifies actual payment and marks the order **paid**. A **purchase confirmation** is prepared once, using **customer name → order reference → purchase date in IST**. This matches the supplied template's three-parameter shape. The older payment-receipt event is retained for old queue records; new paid purchases use purchase confirmation to avoid duplicate receipts.
5. Staff updates confirmation/processing. When marked **shipped**, the customer gets carrier/tracking details. Updated tracking replaces obsolete pending dispatch details. Customer accounts also show the tracking reference and optional HTTPS tracking link.
6. Delivered/cancelled stages prepare normal status updates. Paid/cancelled orders suppress payment reminders. An unpaid order cannot be marked refunded; a newly paid cancelled order is rejected.
7. A manually recorded **refund** prepares a refund-status message. This action records status only; it does not initiate a financial refund.

## Other connected flows

- Enquiry/contact/trade-application acknowledgement.
- Appointment booking/rescheduling confirmation, followed by a due-time reminder.
- Follow-up reminders, repair/custom-piece ready notices; completion suppresses old pending notices.
- Trade account provisioning prepares an account-ready message for the linked customer. Passwords/tokens are never inserted into that message; the trade desk shares initial credentials separately.
- Consent, STOP/START, sending hours, throttling, delivery/read tracking, bounded rejection retries and uncertain-outcome reconciliation continue to apply.

## Credentials and activation

Imported values live in private `.env.local` only. The importer generates local webhook-verification and worker secrets when absent; it cannot generate the **actual Meta App Secret**. It imports the sample purchase mapping as **unapproved** and keeps live sending paused/preview. No historical previews are released.

The supplied `WHATSAPP_TEST_RECIPIENT` becomes a **test recipient allowlist**. Other customer numbers are blocked before a provider request. Messages are never redirected to the test number. After a production number is registered and tested, remove the allowlist only when intended to permit actual opted-in customers.

The remaining activation items are the real Meta App Secret, a public HTTPS app/webhook origin, template copy/approval verification and production-number/recipient readiness. A WABA ID is useful for template management but is not a substitute for the App Secret. Until activation, purchase messages are visible in CRM → WhatsApp → Outbox as previews or blocked records, not as delivered messages.

Commands (do not put secrets on the command line):

```powershell
npm run whatsapp:import -- --credentials D:\Jewellery\cred
npm run whatsapp:check
```

The importer is repeatable and defaults to preview. The check performs a read-only request and writes a redacted report to `test-results/whatsapp-account-check.json`. There is no automatic test-message send. Replacing/importing a token does not approve a template, consent a customer or enable live sending.

See [WhatsApp activation guide](WHATSAPP.md) for deployment and webhook steps. Product prices/stock must be configured before real purchases can be accepted. Tests use isolated synthetic products/orders and a mocked messaging provider; no real customer messages are sent by the tests.
