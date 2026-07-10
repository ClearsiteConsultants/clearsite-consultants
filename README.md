# Clearsite Consultants

Business website and client portal for Clearsite Consultants.

This branch is a Next.js App Router implementation that includes:
- a public marketing homepage
- client authentication (sign up / sign in)
- a client portal view
- admin invoice management (QuickBooks-native creation and manual-link for pre-existing invoices)

## Tech Stack

- **Next.js 16 (App Router)**
- **React 19 + TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui + Radix UI primitives**
- **NextAuth (credentials provider)**
- **PostgreSQL** via `postgres` npm package (Neon in production, local PostgreSQL in dev)
- **QuickBooks Online API** for invoice creation, payment links, on-demand PDF download, and webhook status sync

## Invoice Workflow

### QuickBooks-native creation (default)
Admin enters **client**, optional **product/service** (dropdown), **amount**, optional **invoice date**, and **due date**. The app:
1. Ensures a QuickBooks customer exists for the client (creates one if not).
2. Creates the invoice in QuickBooks — QuickBooks auto-generates the invoice/doc number.
   - If a product/service is selected, its item ID is passed to QBO and its unit price auto-fills the amount field.
   - If an invoice date is provided, it is passed as `TxnDate` to QBO.
3. Stores QuickBooks invoice metadata locally (invoice ID, doc number, payment URL, dates, totals) and defers PDF retrieval to download time.
4. Persists the QuickBooks invoice ID, doc number, payment URL, invoice date, and invoice total (`invoice_total`).
5. Returns all of this in the API response; the portal shows Pay Now and Download PDF.

### Manual-link mode (for pre-existing QuickBooks invoices)
Admin can link an already-existing QuickBooks invoice without creating a new one:
- Required: **client** and **QuickBooks invoice number** (the `DocNumber` / `qbo_doc_number`).
- The server looks up the invoice in QuickBooks constrained to the client's QBO customer ID.
- All invoice fields (date, due date, amount, payment URL) are synced automatically.
- Returns 404 if no matching invoice found, 409 if already linked.
- Saved invoices are tagged as **"Manually linked"** in the portal.

### Portal
Clients see the QuickBooks-generated doc number, **Invoice Date**, **Due Date**, **TOTAL** (`invoice_total`), a **Pay Now** button, and a **Download PDF** link.

- `/api/invoices/[id]/pdf` now downloads the PDF from QuickBooks on demand using `qbo_invoice_id`; PDF bytes are not stored in the database.
- For unpaid invoices where `qbo_payment_url` is missing, Pay Now is disabled and the portal shows a Contact Support call-to-action with a deep link that prefills contact context.
- Admin users are blocked from downloading client invoice PDFs from this endpoint and are instructed to use QuickBooks Online directly.

## Automated Maintenance Invoicing

The system automates recurring maintenance fee invoice generation, ensuring strict validation and synchronization with QuickBooks Online.

### Core Architecture & Validation Rules
- **Status Validation**: Setting `service_status = "Active"` is blocked unless `client_status` is `"Active"`, `plan` is a valid value (either `"Starter"` or `"Feature-Rich"`), and `maintenance_fee_frequency` is not null.
- **Service Start Date**: When `service_status` becomes `"Active"`, the database records the UTC date as `service_start_date` standard format. Both client and admin screens adapt display strings using their local display timezones.
- **Terms Mapping**: Automated maintenance fee invoices are created with **Net 15** payment terms (distinct from standard "Net 30" manual invoices), bypassing net-30 terms calculations.

### Invoice Timing, Dates and Posting Schedule
1. **Initial Charge**: The first maintenance fee, whether monthly or yearly, is paid manually out-of-band by the client beforehand.
2. **First Automated Invoice**: Posted as soon as `service_status` becomes active and sets `service_start_date`.
3. **Monthly Frequency**:
   - The first automated invoice is dated on `service_start_date` with `due_date` being the 15th of the following month (Net 15 terms).
   - Subsequent invoices are dated on the 16th of each month, due on the 15th of the subsequent month (e.g., posted August 16th, due September 15th).
4. **Yearly Frequency**:
   - First year of maintenance is manual.
   - Subsequent invoice is dated 10 months after `service_start_date` (on the 16th) and due in month 12 (on the 15th) — giving clients exactly 2 extra months to review the larger amount. (e.g. `service_start_date = 2026-07-03`, next posted on `2027-05-16`, due `2027-07-15`).

### Plan and Frequency Adjustments
- **Monthly - Plan Changes**: Changing plan from Starter to Feature-Rich immediately updates any unpaid maintenance invoices in QuickBooks and local DB to item ID `4`.
- **Monthly to Yearly Changes**: Changes next posted invoice to item ID `10` ($200) and updates any unpaid maintenance invoices to the new annual itemId.
- **Yearly to Monthly Changes**: Does not take effect until the current year they already paid for is completed and their next maintenance renewal date is reached.

### QuickBooks Item Mapping

| Plan | Frequency | QuickBooks Item ID | Amount |
|---|---|---|---|
| Starter | Monthly | `5` | $10.00 |
| Starter | Yearly | `9` | $100.00 |
| Feature-Rich | Monthly | `4` | $20.00 |
| Feature-Rich | Yearly | `10` | $200.00 |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local Next.js development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server from the build output |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit + route tests |
| `npm run test:coverage` | Run Vitest with coverage reporting |
| `npm run db:bootstrap` | Create required tables in the database targeted by `POSTGRES_URL` or `DATABASE_URL` |

## Implementation Workflow

Use this workflow for each end-to-end implementation effort:

1. Create one GitHub issue for the entire implementation scope.
2. Set the issue description to the full implementation plan (for example, use `plan.md` as the issue body).
3. Create one dedicated branch linked to that issue.
4. Make one commit per major implementation cycle on that branch.
5. Open a pull request after all work is complete.
6. Include `Closes #<issue-number>` in the pull request description so the issue closes automatically when the PR is merged.

## Local Database Setup (Windows + PostgreSQL)

This project uses the `postgres` npm package in app code, so local development should provide
`POSTGRES_URL`/`DATABASE_URL` values pointing to your local PostgreSQL instance.

### 1. Use a local-only `.env.local`

Set DB values to localhost:

```dotenv
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
POSTGRES_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=GENERATE_A_32_PLUS_CHAR_SECRET
NEXTAUTH_SECRET=GENERATE_A_32_PLUS_CHAR_SECRET

# Required for contact form email delivery via Resend
RESEND_API_KEY=YOUR_RESEND_API_KEY
CONTACT_TO_EMAIL=YOUR_INBOX_EMAIL
# Use a verified sender in production. Resend test sender shown below.
CONTACT_FROM_EMAIL="Clearsite Contact <onboarding@resend.dev>"

# Required for QuickBooks integration
QUICKBOOKS_ENVIRONMENT="sandbox"
QUICKBOOKS_CLIENT_ID=YOUR_INTUIT_APP_CLIENT_ID
QUICKBOOKS_CLIENT_SECRET=YOUR_INTUIT_APP_CLIENT_SECRET
QUICKBOOKS_REDIRECT_URI="http://localhost:3000/api/integrations/quickbooks/callback"
# Optional fallback item ID — used when no product/service is selected in the invoice form
QUICKBOOKS_DEFAULT_ITEM_ID=YOUR_QUICKBOOKS_SERVICE_ITEM_ID
QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN=YOUR_INTUIT_WEBHOOK_TOKEN
```

> **Password with special characters**: Next.js expands `$` in `.env` files as a variable reference.
> Escape any literal `$` in your DB password with a backslash: `admin\$123`
>
> **`BLOB_READ_WRITE_TOKEN` is no longer required.** Invoice PDFs are fetched from QuickBooks on demand
> by `/api/invoices/[id]/pdf`.

### 2. Create local tables

The bootstrap script loads `.env.local` automatically, so if your local `POSTGRES_URL` or `DATABASE_URL`
points to localhost, this command creates the tables in your local database:

```powershell
npm run db:bootstrap
```

You can still use the raw SQL file if preferred:

```powershell
$env:PGPASSWORD = "YOUR_DB_PASSWORD"
psql -h localhost -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -f .\scripts\bootstrap-local.sql
```

This creates (or updates) the required tables and columns:
- `clients` (with `qbo_customer_id`)
- `subscriptions`
- `invoices` (with `qbo_invoice_id`, `qbo_doc_number`, `qbo_sync_status`, `qbo_payment_url`,
  `invoice_date`, `invoice_total`, `amount_paid`, `paid_at`, `last_synced_at`, `is_manual_link`, `notes`)
- `quickbooks_connections`
  - includes reconnect state columns: `reconnect_required`, `reconnect_reason`, `last_auth_error_code`, `last_auth_error_at`
- `error_logs` (used for API diagnostics and action-needed issue context)

## QuickBooks reconnect-required schema notes

- Migration is additive only: new columns are added to `quickbooks_connections` with safe defaults (`reconnect_required = false`).
- Rollback is code-first: redeploy previous code if needed; additive columns can remain in place without breaking older builds.
- Optional hard rollback SQL (only if required by your policy):
  - `ALTER TABLE quickbooks_connections DROP COLUMN IF EXISTS reconnect_required, DROP COLUMN IF EXISTS reconnect_reason, DROP COLUMN IF EXISTS last_auth_error_code, DROP COLUMN IF EXISTS last_auth_error_at;`

## Automated testing (Vitest)

- Tests run locally without live Intuit API calls; use mocks for OAuth/API responses.
- Keep sanitized fixture-style payloads in tests (do not commit raw OAuth tokens).
- Run:
  - `npm run test`
  - `npm run test:coverage`

### 3. Start app and verify auth flow

```powershell
npm run dev
```

Then open `/login`, sign up, sign out, and sign in again.
If local login works, your account rows should appear in your local DB.

## Production Database Setup (Neon)

Production will not auto-create tables unless you explicitly run a bootstrap or migration step.

### 1. Set Neon connection string in PowerShell

```powershell
$env:POSTGRES_URL = "postgresql://USER:PASSWORD@YOUR-NEON-HOST/neondb?sslmode=require"
```

### 2. Run idempotent bootstrap

```powershell
npm run db:bootstrap
```

This safely adds any missing columns to existing tables (idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).
Run this **before** deploying the new UI to production.

### 3. Verify in Neon SQL editor

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;
```

Expected columns include: `qbo_doc_number`, `invoice_date`, `invoice_total`, `amount_paid`,
`paid_at`, `last_synced_at`, `is_manual_link`, `notes`.

## Project Structure

```text
app/
  page.tsx                       # Public homepage
  layout.tsx                     # Root layout
  login/page.tsx                 # Client sign in / sign up
  portal/page.tsx                # Client portal (redirects admins to /admin)
  admin/
    page.tsx                     # Admin dashboard — manage client accounts
    invoices/page.tsx            # Admin invoice UI (QBO-create + manual-link modes)
  api/
    auth/[...nextauth]/route.ts  # NextAuth handlers (dual-table auth)
    auth/register/route.ts       # Client registration endpoint
    admin/clients/route.ts       # Admin API — list and update clients
    admin/clients/[clientId]/action-needed/route.ts # Admin API — issue detail feed for action-needed clients
    contact/route.ts             # Contact form endpoint (sends email via Resend)
    integrations/quickbooks/     # QuickBooks OAuth connect/callback/status
    invoices/route.ts            # Invoice + plan management endpoints
    invoices/[id]/pdf/route.ts   # Authenticated client-only PDF download endpoint (fetched live from QBO)
    webhooks/quickbooks/route.ts # QuickBooks webhook receiver
    upload/route.ts              # Legacy invoice file upload endpoint (kept for backward compatibility)

components/
  ui/                            # shadcn/ui components
  Header.tsx, Hero.tsx, ...      # Section components used by homepage

lib/
  db.ts                          # Postgres connection + data access helpers
  quickbooks.ts                  # QuickBooks API helpers (OAuth, invoices, PDF download)
  quickbooks-sync.ts             # Sync orchestration (customer match/create, invoice sync)
  portal-contact.ts              # Portal helper for missing-payment-link Contact Support deep links
  contact-prefill.ts             # Contact form prefill helpers for missing-payment-link context

scripts/
  bootstrap-local.sql            # Local DB bootstrap script
  bootstrap-db.mjs               # Production DB bootstrap script
```

## Auth Model

This app uses two separate database tables for authentication:

| Table | Source | Portal |
|---|---|---|
| `clients` | Sign Up in this app | `/portal` (client portal) |
| `users` | Accounts from client-finder-portal | `/admin` (admin dashboard) |

Login checks `clients` first. If no match, it falls back to `users`. The resolved `user_type` (`client` or `admin`) is stored in the JWT and used throughout the app to gate access.

The `users` table is never written to by this app — it is read-only for admin authentication.

### Admin vs. Client Account Settings

- **Clients**: Can edit their email and change their password directly from the `/account-settings` page.
- **Admins**: Must change their email and password from the command line (e.g., via direct database access or the management scripts below). The UI for editing these fields doesn't exist for admin accounts.

### Admin Management Scripts

Since admin accounts are stored in the `users` table and are read-only within the app's UI, use these scripts for management:

#### Create an admin user
```bash
# Usage: npm run admin:create <email> <password> [name]
npm run admin:create admin@example.com StrongPassword123! "Admin User"
```

#### Update an admin email
```bash
# Usage: npm run admin:update-email <old_email> <new_email>
npm run admin:update-email old@example.com new@example.com
```

#### Reset an admin password
```bash
# Usage: npm run admin:reset-password <email> <new_password>
npm run admin:reset-password admin@example.com NewStrongPassword456!
```

*Note: These scripts use the modern HMAC-SHA256 + bcrypt hashing required by this application. Using these scripts to reset a password for an account also used in `client-finder-portal` will break that account's login there until that project is updated to the same hashing standard.*

## Key Conventions

- **Path alias**: `@/*` resolves from project root.
- **Routing**: App Router file-system routing under `app/`.
- **Auth**: NextAuth credential flow lives in `app/api/auth/[...nextauth]/route.ts`.
- **Database access**: SQL helpers are centralized in `lib/db.ts`.
- **Invoice PDF delivery**: `/api/invoices/[id]/pdf` fetches from QuickBooks on demand and returns an attachment response. Clients can only download their own invoices; admins are blocked from this endpoint.
- **Missing payment-link handling**: Admin client rows expose an **Action needed** badge when unpaid invoices are missing `qbo_payment_url`. Clicking the badge opens issue details from `/api/admin/clients/[clientId]/action-needed`, preferring `MissingQboPaymentUrl` log messages when present (client `/api/invoices` fetch does not create these warnings).
- **Missing payment-link developer log origins**: `MissingQboPaymentUrl` warnings include `metadata.origin` values of `admin-create`, `admin-link`, `admin-sync`, `portal-read`, or `qbo-webhook`.
- **Developer log retention behavior**: The retention window and max retained entry count are soft-coded from code-configured values rather than fixed UI strings. The current configured defaults are 30 days and 150 retained error-log entries.
- **Developer log duplicate cleanup**: Manual Sync can re-log `MissingQboPaymentUrl` warnings. When retaining a new row would exceed the max entry count, cleanup first deletes older exact duplicates and keeps only the newest exact duplicate. An exact duplicate means the same Route, Method, Status, Error, and User values, even if the timestamp differs. If the log count is still over the configured max after duplicate cleanup, oldest-log pruning runs next.
- **Webhook anti-spam rule**: `qbo-webhook` logging only writes `MissingQboPaymentUrl` when an invoice transitions from non-empty `qbo_payment_url` to empty/null; null->null webhook updates do not log.
- **Pricing data**: Website pricing display values are maintained in `components/Pricing.tsx`.
- **Contact endpoint**: `app/api/contact/route.ts` sends contact emails through Resend.

## Blake Autopilot Quick Checklist

Use this checklist during day-to-day autopilot sessions:

- Confirm you are on the intended branch before launching autopilot tasks.
- Keep secrets only in `.env.local`; never paste API keys, tokens, or passwords into prompts.
- Review planned file writes and command intent before approval, especially for auth, integration, and DB areas.
- Treat writes outside the workspace or to critical governance/security paths as stop-and-review events.
- Require explicit approval for risky actions (`git push`, publish actions, external API calls, DB mutations).
- Watch for exfiltration patterns (secret access + outbound call) and cancel immediately if suspected.
- If Blake pauses an agent, read the alert, then explicitly `approve`, `investigate`, or `cancel`.
- For a Critical incident, do not resume until the incident report and containment actions are reviewed.
- Rotate any exposed credential immediately; consider any leaked secret compromised.
- Remember: only the user can restart work after a full Blake shutdown.

Full policy: `.github/agents/squad.agent.md` -> **Blake Autopilot Security Protections**.

## QuickBooks Setup

1. Create an Intuit app and enable QuickBooks Online Accounting scope.
2. Add this callback URL in Intuit developer settings:
	- `http://localhost:3000/api/integrations/quickbooks/callback`
3. Set QuickBooks env vars (`QUICKBOOKS_*`) in `.env.local` and Vercel.
4. In QuickBooks, create a service item (e.g. "Consulting") and set its ID as `QUICKBOOKS_DEFAULT_ITEM_ID`.
   - To find the item ID, run: `node scripts/list-qbo-items.mjs` — this prints all active items with their IDs.
5. Connect from the admin invoice page (`/admin/invoices`) using **Connect QuickBooks**.
6. Configure QuickBooks webhook destination:
	- `https://YOUR_DOMAIN/api/webhooks/quickbooks`

### Behavior after setup

- Admin creates invoices from `/admin/invoices` using only client, amount, and due date.
- QuickBooks auto-generates the invoice/doc number; admin never enters it manually.
- Client portal invoices (`/portal`) show the QuickBooks doc number, a Pay Now button (when `qbo_payment_url` is present), and a Download PDF link (served from `/api/invoices/[id]/pdf`).
- `/api/invoices/[id]/pdf` fetches the latest PDF bytes from QuickBooks at request time and does not rely on stored `pdf_*` columns.
- QuickBooks webhook events update local `qbo_sync_status`, `amount_paid`, and `paid_at` without overwriting persisted doc metadata.
- QuickBooks webhook events can clear stored `qbo_payment_url` values when QuickBooks now reports no payment link; transition logging is deduped and origin-tagged.
- Manually linked invoices (via the "Link Existing Invoice" tab) are tagged as "Manually linked" in the portal.
- If an unpaid invoice has no `qbo_payment_url`, the portal disables Pay Now and shows a Contact Support link that deep-links to `/?contactContext=missing-qbo-payment-url&invoiceId=...&qboDocNumber=...#contact`.

## Admin Manual Sync

- `/admin` includes a **Manual Sync** button that calls `POST /api/admin/sync`.
- This endpoint runs an admin-triggered refresh for:
  - Invoice sync state used by the Admin Dashboard Client Accounts and Action Needed freshness.
  - QuickBooks Products/Services used by `/admin/invoices` create flow.
  - QuickBooks Customers used by `/admin/invoices` manual-link "New QBO Client" flow.
- The response returns structured summary counts (`invoiceSync`, `qboData`), an `errors` array, and `developerLogs` metadata indicating whether new `MissingQboPaymentUrl` logs were created during this run.
- Manual sync-triggered missing payment-link warnings are tagged with origin `admin-sync` and still use cooldown dedupe behavior.
- A later Manual Sync run can re-log the same `MissingQboPaymentUrl` warning if the missing-link condition still exists. If that insert would push retained logs past the configured max, older exact duplicates are deleted first so only the newest exact duplicate remains before oldest-log pruning is applied.

## Admin Invoice Modes

### Create in QuickBooks (default)
- Fields: **Client** (dropdown), optional **Product/Service** (QBO item dropdown), **Amount Due** (auto-fills from selected item rate), optional **Invoice Date**, **Due Date**
- QuickBooks auto-generates the invoice number
- PDF is delivered on demand from QuickBooks via `/api/invoices/[id]/pdf` (no DB blob storage)
- Success message includes the QuickBooks-generated doc number

### Link Existing Invoice (manual-link)
Use this mode to attach a pre-existing QuickBooks invoice to a local client account without creating a new QuickBooks invoice.
- Required fields: **Client**, **QuickBooks Invoice Number** (the `DocNumber` / `qbo_doc_number`)
- Server performs a QBO lookup by invoice number constrained to the client's QBO customer ID
- All invoice data (date, due date, amount, total, payment URL) is synced automatically
- Returns 404 if the invoice number does not match any QBO invoice for that client
- Returns 409 if the invoice is already linked to this client

## Deployment (Vercel)

### Required environment variables

| Variable | Purpose |
|---|---|
| `NEXTAUTH_URL` | Full URL of the deployed app (e.g. `https://your-domain.vercel.app`) |
| `AUTH_SECRET` | 32+ char secret for Auth.js v5 |
| `NEXTAUTH_SECRET` | Same value as `AUTH_SECRET` for backward compatibility |
| `POSTGRES_URL` / `DATABASE_URL` | Neon (or other) PostgreSQL connection string |
| `RESEND_API_KEY` | Resend API key for contact form emails |
| `CONTACT_TO_EMAIL` | Recipient email for contact form |
| `CONTACT_FROM_EMAIL` | Sender email (must be a verified Resend domain/email in production) |
| `QUICKBOOKS_ENVIRONMENT` | `"sandbox"` or `"production"` |
| `QUICKBOOKS_CLIENT_ID` | Intuit app client ID |
| `QUICKBOOKS_CLIENT_SECRET` | Intuit app client secret |
| `QUICKBOOKS_REDIRECT_URI` | `https://YOUR_DOMAIN/api/integrations/quickbooks/callback` |
| `QUICKBOOKS_DEFAULT_ITEM_ID` | QuickBooks service item ID for invoice line items |
| `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` | Intuit webhook verifier token |
| `DISCOVERY_CACHE_TTL_MINUTES` | Cache TTL for OAuth discovery document (optional, default: 30 minutes). Lower values mean more frequent endpoint updates but higher API calls. |

> `BLOB_READ_WRITE_TOKEN` is no longer required for the invoice flow. It can be kept if you use the legacy upload endpoint for other purposes.

### Rollout order

1. **Run the DB bootstrap from `scripts/bootstrap-db.mjs`** (`npm run db:bootstrap` targeting production) **before** deploying the new code.
  This applies the current schema updates needed by the app.
2. Deploy the new code.
3. Reconnect QuickBooks from `/admin/invoices` if the OAuth tokens expired during the rollout.
4. Create one test invoice in the admin UI and verify the portal shows the QBO doc number, Invoice Date, Due Date, Pay Now, and Download PDF.
5. Verify an unpaid invoice missing `qbo_payment_url` shows `Action needed` in `/admin`, opens issue details, and shows Contact Support guidance in `/portal`.

### Rollback

If you need to roll back:
1. Redeploy the previous code version (Vercel instant rollback).
2. Re-run local setup with `scripts/bootstrap-local.sql` only for local environments; production rollback schema changes must be handled explicitly.

## PDF Delivery Notes

- `/api/invoices/[id]/pdf` now retrieves PDFs from QuickBooks on demand and returns them as attachments.
- Endpoint access control is strict: authenticated clients can only fetch their own invoices; admin users receive a 403 response and must use QuickBooks Online for admin PDF access.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [QuickBooks Online API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice)
