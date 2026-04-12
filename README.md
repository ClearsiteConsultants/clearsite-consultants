This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local Database Setup (Windows + pgAdmin/PostgreSQL)

This project uses `@vercel/postgres` in the app code, so local development should provide
`POSTGRES_URL` variables that point to your local PostgreSQL instance.

### 1. Use a local-only `.env.local`

Set all DB variables to localhost (no Neon/Vercel hostnames):

```dotenv
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"
DATABASE_URL_UNPOOLED="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME"

NEXTAUTH_URL=http://localhost:3000
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
```

### 2. Run one-time SQL bootstrap

`.env.local` is read by Next.js, not automatically loaded into PowerShell. Run the bootstrap script with explicit local database parameters:

```powershell
$env:PGPASSWORD = "YOUR_DB_PASSWORD"
psql -h localhost -p 5432 -U YOUR_DB_USER -d YOUR_DB_NAME -f .\scripts\bootstrap-local.sql
```

If `psql` is not on your PATH yet, replace `psql` with the full executable path: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe"`

This creates required tables:
- `clients`
- `subscriptions`
- `invoices`

### 3. Start the app and test auth

```powershell
npm run dev
```

Then open `/login`, sign up, sign out, and sign in again.
If local login works, your account rows should now appear in your local database (`YOUR_DB_NAME`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
