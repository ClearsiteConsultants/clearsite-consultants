# ClearSite Consultants

Business website and client portal for ClearSite Consultants.

This branch is a Next.js App Router implementation that includes:
- a public marketing homepage
- client authentication (sign up / sign in)
- a client portal view
- admin invoice upload and invoice-related API endpoints

## Tech Stack

- **Next.js 16 (App Router)**
- **React 19 + TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui + Radix UI primitives**
- **NextAuth (credentials provider)**
- **PostgreSQL** via `@vercel/postgres` + `postgres`
- **Vercel Blob** for invoice file uploads

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

This project uses `@vercel/postgres` in app code, so local development should provide
`POSTGRES_URL`/`DATABASE_URL` values pointing to your local PostgreSQL instance.

### 1. Use a local-only `.env.local`

Set DB values to localhost:

```dotenv
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=GENERATE_A_32_PLUS_CHAR_SECRET
NEXTAUTH_SECRET=GENERATE_A_32_PLUS_CHAR_SECRET

POSTGRES_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

RESEND_API_KEY="your-resend-api-key"
CONTACT_TO_EMAIL="recipient-email"
CONTACT_FROM_EMAIL="sender-email"

# Required for admin invoice uploads via /api/upload (Vercel Blob storage token)
BLOB_READ_WRITE_TOKEN=YOUR_BLOB_TOKEN

# Required for contact form email delivery via Resend
RESEND_API_KEY=YOUR_RESEND_API_KEY
CONTACT_TO_EMAIL=YOUR_INBOX_EMAIL
# Use a verified sender in production. Resend test sender shown below.
CONTACT_FROM_EMAIL="ClearSite Contact <onboarding@resend.dev>"
```

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

If `psql` is not on your PATH, use full executable path:
`& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`

This creates required tables:
- `clients`
- `subscriptions`
- `invoices`

### 3. Start app and verify auth flow

```powershell
npm run dev
```

Then open `/login`, sign up, sign out, and sign in again.
If local login works, your account rows should appear in your local DB.

## Production Database Setup (Neon)

Production will not auto-create tables unless you explicitly run a bootstrap or migration step.

Important: `.env.local` in this repo points to localhost for development. If you run `npm run db:bootstrap`
without overriding the connection string in your shell, it will target your local database, not Neon.

### 1. Set Neon connection string in PowerShell

Set `POSTGRES_URL` to your Neon production connection string for the current PowerShell session:

```powershell
$env:POSTGRES_URL = "postgresql://USER:PASSWORD@YOUR-NEON-HOST/neondb?sslmode=require"
```

Optional: verify that the shell is targeting Neon instead of localhost before bootstrapping:

```powershell
node -e "require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); const u = new URL(process.env.POSTGRES_URL || process.env.DATABASE_URL); console.log('host=' + u.hostname); console.log('db=' + u.pathname.slice(1));"
```

The printed host should be your Neon host, not `localhost`.

### 2. Run idempotent bootstrap

```powershell
npm run db:bootstrap
```

This safely ensures these tables exist:
- `clients`
- `subscriptions`
- `invoices`

### 3. Verify in Neon SQL editor

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('clients', 'subscriptions', 'invoices')
ORDER BY tablename;
```

### 4. Optional cleanup

Remove the temporary PowerShell override after bootstrapping:

```powershell
Remove-Item Env:POSTGRES_URL
```

## Project Structure

```text
app/
	page.tsx                       # Public homepage
	layout.tsx                     # Root layout
	login/page.tsx                 # Client sign in / sign up
	portal/page.tsx                # Client portal
	admin/invoices/page.tsx        # Admin invoice upload UI
	api/
		auth/[...nextauth]/route.ts  # NextAuth handlers
		auth/register/route.ts       # Registration endpoint
		contact/route.ts             # Contact form endpoint (sends email via Resend)
		invoices/route.ts            # Invoice + plan management endpoints
		upload/route.ts              # Invoice file upload endpoint

components/
	ui/                            # shadcn/ui components
	Header.tsx, Hero.tsx, ...      # Section components used by homepage

lib/
	db.ts                          # Postgres connection + data access helpers

scripts/
	bootstrap-local.sql            # Local DB bootstrap script
```

## Key Conventions

- **Path alias**: `@/*` resolves from project root.
- **Routing**: App Router file-system routing under `app/`.
- **Auth**: NextAuth credential flow lives in `app/api/auth/[...nextauth]/route.ts`.
- **Database access**: SQL helpers are centralized in `lib/db.ts`.
- **Pricing data**: Website pricing display values are maintained in `components/Pricing.tsx`.
- **Contact endpoint**: `app/api/contact/route.ts` sends contact emails through Resend.

## Deployment (Vercel)

1. Push branch to GitHub and connect/import project in Vercel.
2. Set required environment variables in Vercel:
	 - `NEXTAUTH_URL`
	 - `AUTH_SECRET` (preferred for Auth.js v5)
	 - `NEXTAUTH_SECRET`
	 - Database variables (`POSTGRES_URL` and/or `DATABASE_URL`)
	 - `BLOB_READ_WRITE_TOKEN` (if invoice upload is enabled)
	 - `RESEND_API_KEY`
	 - `CONTACT_TO_EMAIL`
	 - `CONTACT_FROM_EMAIL`
3. Run a production deploy.
4. Validate core flows in deployed environment:
	 - Sign up/sign in at `/login`
	 - Portal access at `/portal`
	 - Invoice upload flow under admin invoices

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth Documentation](https://next-auth.js.org/)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
