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
- **QuickBooks Online API** for invoice creation, payment links, PDF storage, and webhook status sync

## Invoice Workflow

### QuickBooks-native creation (default)
Admin enters **client**, **amount**, and **due date** only. The app:
1. Ensures a QuickBooks customer exists for the client (creates one if not).
2. Creates the invoice in QuickBooks — QuickBooks auto-generates the invoice/doc number.
3. Downloads the invoice PDF from QuickBooks and stores it in the database.
4. Persists the QuickBooks invoice ID, doc number, payment URL, and PDF metadata.
5. Returns all of this in the API response; the portal immediately shows Pay Now and View PDF.

### Manual-link mode (for pre-existing QuickBooks invoices)
Admin can link an already-existing QuickBooks invoice without creating a new one:
- Required: client, QuickBooks payment link (must be an HTTPS intuit.com URL), amount, due date.
- Optional: invoice number override, QuickBooks invoice ID (for future webhook reconciliation), internal notes.
- Saved invoices are tagged as **"Manually linked"** in the portal.

### Portal
Clients see the QuickBooks-generated doc number (falling back to local invoice number), a **Pay Now** button (from the stored QuickBooks payment URL), and a **View PDF** button (served from the stored PDF endpoint `/api/invoices/[id]/pdf`). Legacy invoices with a `file_url` still show their PDF link.

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
| `npm run db:bootstrap` | Create required tables in the database targeted by `POSTGRES_URL` or `DATABASE_URL` |

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
QUICKBOOKS_DEFAULT_ITEM_ID=YOUR_QUICKBOOKS_SERVICE_ITEM_ID
QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN=YOUR_INTUIT_WEBHOOK_TOKEN
```

> **Password with special characters**: Next.js expands `$` in `.env` files as a variable reference.
> Escape any literal `$` in your DB password with a backslash: `admin\$123`
>
> **`BLOB_READ_WRITE_TOKEN` is no longer required.** The new QuickBooks-native flow downloads invoice
> PDFs from QuickBooks and stores them in the database (`pdf_data` column). The legacy `/api/upload`
> endpoint is still present for backward compatibility but is no longer used by the admin UI.

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
  `pdf_data`, `pdf_mime_type`, `pdf_filename`, `pdf_size`, `is_manual_link`, `notes`)
- `quickbooks_connections`

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

Expected columns include: `qbo_doc_number`, `pdf_data`, `pdf_mime_type`, `pdf_filename`, `pdf_size`,
`is_manual_link`, `notes`.

## Project Structure

```text
app/
  page.tsx                       # Public homepage
  layout.tsx                     # Root layout
  login/page.tsx                 # Client sign in / sign up
  portal/page.tsx                # Client portal (redirects admins to /admin/clients)
  admin/
    clients/page.tsx             # Admin dashboard — manage all client accounts
    invoices/page.tsx            # Admin invoice UI (QBO-create + manual-link modes)
  api/
    auth/[...nextauth]/route.ts  # NextAuth handlers (dual-table auth)
    auth/register/route.ts       # Client registration endpoint
    admin/clients/route.ts       # Admin API — list and update clients
    contact/route.ts             # Contact form endpoint (sends email via Resend)
    integrations/quickbooks/     # QuickBooks OAuth connect/callback/status
    invoices/route.ts            # Invoice + plan management endpoints
    invoices/[id]/pdf/route.ts   # Authenticated PDF delivery endpoint
    webhooks/quickbooks/route.ts # QuickBooks webhook receiver
    upload/route.ts              # Legacy invoice file upload endpoint (kept for backward compatibility)

components/
  ui/                            # shadcn/ui components
  Header.tsx, Hero.tsx, ...      # Section components used by homepage

lib/
  db.ts                          # Postgres connection + data access helpers
  quickbooks.ts                  # QuickBooks API helpers (OAuth, invoices, PDF download)
  quickbooks-sync.ts             # Sync orchestration (customer match/create, invoice sync, PDF store)

scripts/
  bootstrap-local.sql            # Local DB bootstrap script
  bootstrap-db.mjs               # Production DB bootstrap script
```

## Auth Model

This app uses two separate database tables for authentication:

| Table | Source | Portal |
|---|---|---|
| `clients` | Sign Up in this app | `/portal` (client portal) |
| `users` | Accounts from client-finder-portal | `/admin/clients` (admin dashboard) |

Login checks `clients` first. If no match, it falls back to `users`. The resolved `user_type` (`client` or `admin`) is stored in the JWT and used throughout the app to gate access.

The `users` table is never written to by this app — it is read-only for admin authentication.

## Key Conventions

- **Path alias**: `@/*` resolves from project root.
- **Routing**: App Router file-system routing under `app/`.
- **Auth**: NextAuth credential flow lives in `app/api/auth/[...nextauth]/route.ts`.
- **Database access**: SQL helpers are centralized in `lib/db.ts`.
- **Invoice PDF storage**: PDFs are downloaded from QuickBooks and stored as `BYTEA` in the `invoices` table. They are served to authenticated clients via `/api/invoices/[id]/pdf` with strict access control (clients can only access their own invoices).
- **Pricing data**: Website pricing display values are maintained in `components/Pricing.tsx`.
- **Contact endpoint**: `app/api/contact/route.ts` sends contact emails through Resend.

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
- The invoice PDF is downloaded from QuickBooks and stored in the database.
- Client portal invoices (`/portal`) show the QuickBooks doc number, a Pay Now button (from the stored QuickBooks payment URL), and a View PDF button (served from `/api/invoices/[id]/pdf`).
- QuickBooks webhook events update local `qbo_sync_status`, `amount_paid`, and `paid_at` without overwriting the stored PDF or doc number.
- Manually linked invoices (via the "Link Existing Invoice" tab) are tagged as "Manually linked" in the portal.

## Admin Invoice Modes

### Create in QuickBooks (default)
- Fields: **Client** (dropdown), **Amount Due**, **Due Date**
- QuickBooks auto-generates the invoice number
- PDF is downloaded from QuickBooks and stored in the database
- Success message includes the QuickBooks-generated doc number

### Link Existing Invoice (manual-link)
Use this mode to attach a pre-existing QuickBooks invoice to a local client account without creating a new QuickBooks invoice.
- Required fields: **Client**, **QuickBooks Payment Link** (must be `https://…intuit.com/…`), **Amount Due**, **Due Date**
- Optional fields: **Invoice Number**, **QuickBooks Invoice ID** (enables future webhook reconciliation), **Internal Notes**
- Validation errors match the agreed copy (e.g., "Enter a valid https:// QuickBooks payment link.", "Due Date must be today or later.")
- Success message: "Linked QuickBooks invoice saved to client account."

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

> `BLOB_READ_WRITE_TOKEN` is no longer required for the invoice flow. It can be kept if you use the legacy upload endpoint for other purposes.

### Rollout order

1. **Run the DB bootstrap** (`npm run db:bootstrap` targeting production) **before** deploying the new code.
   This adds `qbo_doc_number`, `pdf_data`, `pdf_mime_type`, `pdf_filename`, `pdf_size`, `is_manual_link`, and `notes` columns without breaking existing rows.
2. Deploy the new code.
3. Reconnect QuickBooks from `/admin/invoices` if the OAuth tokens expired during the rollout.
4. Create one test invoice in the admin UI and verify the portal shows the QBO doc number, Pay Now, and View PDF.

### Rollback

If you need to roll back:
1. Redeploy the previous code version (Vercel instant rollback).
2. The schema changes are additive and backward-compatible — old code continues to work against the new schema.
3. No data migration is required to roll back.

## Regression: Legacy Invoices

Pre-existing invoices that have a `file_url` (uploaded PDFs) will continue to display a **View PDF** link in the portal pointing to the original URL. Invoices without `pdf_data` fall back to `file_url` automatically.

## PDF Storage Notes

- PDFs are stored as `BYTEA` in the `invoices` table. For large invoice volumes, monitor database size and consider archival policy.
- Maximum recommended PDF size: QuickBooks typically generates PDFs under 1 MB per invoice.
- The stored PDF endpoint (`/api/invoices/[id]/pdf`) enforces per-client access control: clients can only fetch their own invoices.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [QuickBooks Online API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/most-commonly-used/invoice)

