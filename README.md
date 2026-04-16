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

## Local Database Setup (Windows + PostgreSQL)

This project uses `@vercel/postgres` in app code, so local development should provide
`POSTGRES_URL`/`DATABASE_URL` values pointing to your local PostgreSQL instance.

### 1. Use a local-only `.env.local`

Set DB values to localhost:

```dotenv
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
DATABASE_URL_UNPOOLED="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=YOUR_32_PLUS_CHAR_SECRET
NEXTAUTH_SECRET=YOUR_32_PLUS_CHAR_SECRET

PGHOST=localhost
PGHOST_UNPOOLED=localhost
PGUSER=YOUR_DB_USER
PGDATABASE=YOUR_DB_NAME
PGPASSWORD=YOUR_DB_PASSWORD
PGPORT=5432

POSTGRES_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
POSTGRES_URL_NON_POOLING="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
POSTGRES_USER=YOUR_DB_USER
POSTGRES_HOST=localhost
POSTGRES_PASSWORD=YOUR_DB_PASSWORD
POSTGRES_DATABASE=YOUR_DB_NAME
POSTGRES_URL_NO_SSL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
POSTGRES_PRISMA_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

# Required if using file uploads to Vercel Blob
BLOB_READ_WRITE_TOKEN=YOUR_BLOB_TOKEN
```

### 2. Run one-time SQL bootstrap

`.env.local` is loaded by Next.js, not automatically by PowerShell. Run SQL bootstrap explicitly:

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
		contact/route.ts             # Contact form endpoint (currently logs payload)
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
- **Contact endpoint**: Current `app/api/contact/route.ts` validates and logs payload; integrate an email provider if production email delivery is needed.

## Deployment (Vercel)

1. Push branch to GitHub and connect/import project in Vercel.
2. Set required environment variables in Vercel:
	 - `NEXTAUTH_URL`
	 - `AUTH_SECRET` (preferred for Auth.js v5)
	 - `NEXTAUTH_SECRET`
	 - Database variables (`POSTGRES_URL` and/or `DATABASE_URL`)
	 - `BLOB_READ_WRITE_TOKEN` (if invoice upload is enabled)
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
