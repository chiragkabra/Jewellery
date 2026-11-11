# Project review and jewellery CRM research

Reviewed 11 November 2026. Source project: `D:\Jewellery\Jewellery`; implementation workspace: `C:\Users\ADMIN\Documents\ChatGPT\jewellery`.

## Aapke project mein pehle kya tha

LUMERA ek jewellery storefront tha: Gold, Silver, Diamonds collections; 18 sample catalogue products; retail/trade modes; product bag aur quote drawer; wholesale/private-label/trade-application forms; import/export copy; contact page; animations aur stock photography. Stack: Next.js App Router, React, TypeScript, Tailwind, Framer Motion, GSAP, Lenis aur react-three-fiber.

Backend gaps: enquiry API sirf console logging karti thi; rates API null mock values deti thi; account form aur checkout disabled the; trade documents ke sirf filenames submit hote the; product data static file mein tha. Database, user permissions, CRM, persistent orders aur inventory transactions connected nahi the.

## Ab kya implement hua

Persistent SQLite storage; real staff/trade authentication; CRM dashboard; customer deduplication and history; lead stages; assignee/notes; follow-up/repair/custom-order/appointment tasks; product editing and publication; available stock; server-priced manual-payment checkout; duplicate request protection; stock reservation/cancellation; private trade-document uploads; store-managed metal rates; staff/team roles; account order summaries; audit trail; CRM export; full SQLite backup; integration tests; deployment/setup instructions.

Repair/custom-order records are coordination tasks. Inventory is tracked per product, not per physical hallmarked piece, branch or variant. Quotes are captured and tracked as enquiries; there is no negotiated quotation/PDF approval workflow. These distinctions matter before calling the project a complete jewellery ERP.

## Web research: additions worth making

These are implementation recommendations based on the sources, not a claim that all features below are already built.

| Priority | Addition | Why it fits this business | Current state |
|---|---|---|---|
| First | Customer history + follow-up pipeline | Jewellery client relationships span purchases, enquiries, repairs and repeat visits | Implemented |
| First | Product availability + order lifecycle | Staff need to reconcile pieces sold with pieces available | Implemented at product level |
| First | Private trade onboarding documents | Wholesale/export onboarding needs a review workflow | Upload + staff review implemented; automatic approvals/invitations absent |
| First | Actual jewellery photography, verified contact/company details, approved policies | Existing public content contains placeholders and stock photos | Needs business content |
| Next | Razorpay integration and payment reconciliation | Enables online payment and reduces manual verification | Needs merchant credentials; use verified signed webhooks and deduplication |
| Next | Automated email/WhatsApp follow-up | Notifications for order confirmation, appointments and ready repairs | WhatsApp flow/consent/queue implemented in preview; approval and credentials pending. Email delivery pending |
| Next | Item-level SKU/barcode/HUID inventory | Valuable pieces need traceability beyond an aggregate stock count | Certificate number field exists; per-piece inventory is future work |
| Next | Customer-facing HUID verification guidance | BIS Care supports HUID verification | Link/guidance can be added; no invented BIS verification API |
| Next | Live rate provider with timestamp + staleness policy | Rate-based prices need a clearly identified source and timing | Manual rate board implemented; provider not connected |
| Next | Structured quotation → approval → order | Useful for wholesale, private-label and custom work | Enquiry pipeline exists; negotiated quotes/approval PDFs future work |
| Later | Repair job cards, photos, workshop costs and delivery acknowledgements | Expands the task tracker into a workshop system | Task coordination only |
| Later | Purchase orders, suppliers, returns/exchanges and old-gold valuation | Completes buying/replenishment and return operations | Future modules; confirm actual policies first |
| Later | GST invoice series, accounting export and reconciliation | Sales order records are not tax invoices or a general ledger | Future work after accounting requirements are confirmed |
| Later | Branches, variant inventory, loyalty, birthdays/anniversaries | Useful with growing customer and store volume | Customer segments exist; remaining modules future work |

Jewellery software providers describe inventory, client records, repairs and custom-order intake as connected workflows. This supports prioritising a shared customer history and follow-up tasks rather than maintaining unrelated form inboxes. Sources: [Crystal product overview](https://www.getcrystal.com/) and [Storemate jewellery CRM](https://storematehq.com/storemate-crm/). Provider descriptions are feature references, not independent endorsements.

[BIS Care's official page](https://www.bis.gov.in/bis-apps/?lang=en) describes its Verify HUID feature. Keep genuine certificate/HUID references and guide customers to the official verification channel. This review does not determine your shop's specific legal obligations.

[Razorpay's webhook documentation](https://razorpay.com/docs/webhooks/validate-test) requires signature validation over the raw payload and explains duplicate event handling. A future integration should verify the signature, reconcile the provider order/amount, deduplicate events and mark paid only after a validated payment event. Client-side success alone must not mark an order paid.

[Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) treats route handlers as security boundaries, and [OWASP authorisation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) distinguishes login from permission checks. The implementation checks staff/admin/trade permissions on the server for each protected handler. It uses opaque server sessions in HttpOnly cookies. [Node's SQLite documentation](https://nodejs.org/api/sqlite.html) supplies the built-in database API used here.

## Launch dependencies and known limits

1. Confirm brand legal name, address, actual phone/email, GST/IEC/certification statements, real product prices/weights/photography and the configured tax treatment. There are still original `[XX]`, `[PHONE]`, `[PRICE]` and policy placeholders where facts are unavailable.
2. Confirm delivery, returns, cancellations, repair handling and the privacy policy; current legal pages are placeholders, not approved policies.
3. Configure a persistent hosting service with HTTPS, secure cookies, a durable disk and tested backups. This implementation supports a single Node instance, not ephemeral serverless storage or multiple replicas.
4. Activate the implemented WhatsApp integration after approval; connect actual payment, email, shipping and live-rate services when their business accounts are available. No external messages are sent by the current app.
5. Stock is reserved on order placement until staff fulfil or cancel it. There is no automatic unpaid-order expiry; staff must review pending orders. Delivery is included in current checkout pricing; configure a shipping model before using paid shipping.
6. Team creation is admin-only and manual. Forgotten admin passwords can be recovered with the filesystem CLI; there is no email reset, MFA, SSO or user deactivation interface yet.
7. Documents are private and size/type bounded. Signatures check file type; full malware scanning is not included. Protect the database and backup storage because they contain personal data and uploaded onboarding documents.
8. Lists currently load all records and audit view shows the latest 200 events. Add server pagination, reporting queries and archival before large-scale imports. Rates and orders use the configured store formula; complex bullion, stone-weight, wastage, buyback and branch accounting need separate requirements.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed; all API, CRM, product and collection routes compile.
- `npm run test:backend`: 35 integration check groups plus 27 WhatsApp service check groups, including authentication, permissions, enquiry persistence, uploads, stock transactions, checkout totals, idempotency, concurrent last-item orders, cancellation, private account history, session revocation, export, backup and storefront routes.
- Browser review: account login, CRM dashboard, product editor and mobile layout checked. Screenshots saved under `artifacts/`.

These checks validate local behaviour with synthetic data. They do not certify payment providers, email delivery, production hosting, actual business data or legal/tax compliance.




Latest purchase/credential integration: see [purchase automation update](PURCHASE-AUTOMATION.md). A read-only Meta account check returned HTTP 200 for the supplied Test Number. Production customer delivery is still pending missing activation items; test messages have not been sent.

