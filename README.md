# ClearSite Consultants

Business website for ClearSite Consultants — a single-page React application showcasing services, pricing, and a contact form. The frontend is built with Vite + React + TypeScript + Tailwind CSS. The contact form backend runs as a Vercel serverless function.

## Tech Stack

- **Vite** — build tool and dev server
- **React 18** with **TypeScript**
- **Tailwind CSS** — utility-first styling
- **shadcn/ui** — accessible, composable UI components (Radix UI primitives)
- **React Router v6** — client-side routing
- **React Hook Form** + **Zod** — form handling and validation
- **React Query** (@tanstack/react-query) — server state management
- **Vercel** — hosting and serverless API functions
- **Resend** — transactional email (contact form)

## Developer Setup

### Prerequisites

- **Node.js** ≥ 18 — install via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) or your preferred method
- **npm** (comes with Node) or **bun** (a `bun.lockb` is committed if you prefer bun)

### 1. Clone the repo

```sh
git clone https://github.com/ClearsiteConsultants/clearsite-consultants.git
cd clearsite-consultants
```

### 2. Install dependencies

```sh
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```sh
cp .env.local.example .env.local   # if an example file exists, otherwise create manually
```

Add the following variable (required for the contact form to send emails):

```
RESEND_API_KEY=your_resend_api_key_here
```

You can obtain a free API key at [resend.com](https://resend.com).

> The contact form will still render in development without this key; email sending will simply fail until a valid key is provided.

### 4. Start the development server

```sh
npm run dev
```

The app runs at **http://localhost:8080**.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR on port 8080 |
| `npm run build` | Production build (minified) |
| `npm run build:dev` | Development build (unminified, easier debugging) |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
src/
  pages/            # Page-level components
    Index.tsx       # Main landing page
    NotFound.tsx    # 404 page
  components/       # Feature and layout components
    Header.tsx
    Hero.tsx
    Services.tsx
    WhyUs.tsx
    Pricing.tsx
    Contact.tsx
    Footer.tsx
    ui/             # shadcn/ui component library (Radix UI based)
  assets/           # Static assets (images, etc.)
  hooks/            # Custom React hooks
  lib/              # Utility functions (e.g. cn() helper)
  App.tsx           # Router setup and React Query provider
  main.tsx          # App entry point
  index.css         # Global styles and Tailwind directives

api/
  contact.ts        # Vercel serverless function — handles contact form submissions
```

## Key Conventions

- **Path alias**: `@/` resolves to `src/` (configured in `vite.config.ts` and `tsconfig.json`)
- **Fonts**: Bebas Neue (display headings via `font-display`), Inter (body)
- **Colors / theme**: Customized in `tailwind.config.ts`; primary color and dark mode via CSS variables
- **New routes**: Add `<Route>` entries in `App.tsx` above the catch-all `*` route
- **New pages**: Create in `src/pages/`, import in `App.tsx`
- **UI components**: Use and compose from `src/components/ui/`; edit source directly to customize
- **Pricing values**: All prices are defined as a single `PRICES` constant at the top of `src/components/Pricing.tsx` for easy updates

## Deployment

The project is configured for **Vercel**. The `/api` directory is automatically treated as serverless functions.

1. Push to the `main` branch (or connect the repo in the Vercel dashboard)
2. Set the `RESEND_API_KEY` environment variable in your Vercel project settings
3. Vercel will run `vite build` and deploy automatically
