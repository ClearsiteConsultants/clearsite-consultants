# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClearSite Consultants is a business website built with **Vite**, **React**, **TypeScript**, and **Tailwind CSS**. It showcases services and includes a contact form. The frontend is a single-page React application, with backend API endpoints hosted on Vercel.

## Build and Development Commands

```bash
# Start development server (runs on http://localhost:8080)
npm run dev

# Build for production
npm run build

# Build in development mode (unminified, easier debugging)
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Project Structure

### Frontend (`/src`)
- **`pages/`** - Page components (Index.tsx is the main landing page, NotFound.tsx is the 404 page)
- **`components/`** - React components
  - **`ui/`** - shadcn/ui component library (pre-built, composable UI components)
  - **Other components** - Custom business components (Header, Hero, Services, WhyUs, Contact, Footer, etc.)
- **`assets/`** - Static assets (images, etc.)
- **`lib/`** - Utility functions and helper code
- **`hooks/`** - Custom React hooks
- **`App.tsx`** - Main app component with routing setup (uses React Router)
- **`main.tsx`** - Entry point for React application
- **`index.css`** - Global styles (Tailwind CSS directives)

### Backend (`/api`)
- **`contact.ts`** - Vercel serverless function for handling contact form submissions
  - Uses Resend API for sending emails
  - Accepts POST requests with name, email, bikeModel, and message
  - Requires `RESEND_API_KEY` environment variable (set in `.env.local`)

## Key Technologies and Patterns

### UI Components (shadcn/ui)
The project uses **shadcn/ui**, a collection of pre-built, accessible, and customizable React components built on Radix UI. Components are located in `/src/components/ui/`. These are designed to be copied into the codebase rather than imported as a package, allowing easy customization.

### Styling
- **Tailwind CSS** for utility-based styling with custom configuration in `tailwind.config.ts`
- Custom fonts: Bebas Neue (display), Inter (body)
- Custom animations: `fade-in`, `fade-in-left`, `pulse-glow`, `electric-pulse`
- Dark mode support via `darkMode: ["class"]` configuration

### Routing
- **React Router v6** is configured in `App.tsx` with BrowserRouter
- Currently has two routes: `/` (Index page) and `*` (catch-all NotFound)
- **New routes should be added above the catch-all route** as indicated in the comment in App.tsx

### State Management and Data Fetching
- **React Query** (@tanstack/react-query) is set up in App.tsx for managing server state
- QueryClient is instantiated and provided via QueryClientProvider

### Forms and Validation
- **React Hook Form** for form handling
- **Zod** for schema validation
- **@hookform/resolvers** for integrating Zod with React Hook Form

### API Integration
The contact form in `/src/components/Contact.tsx` submits to `/api/contact` (a Vercel function). When modifying the contact form:
1. Update the request body to match `api/contact.ts` expectations
2. Keep validation consistent between frontend (Zod schema) and backend (request validation in api/contact.ts)
3. Ensure `RESEND_API_KEY` is configured in production environment

## Configuration Files

- **`vite.config.ts`** - Vite configuration with React SWC plugin and path alias `@` pointing to `src/`
- **`tailwind.config.ts`** - Custom Tailwind theme, animations, and dark mode settings
- **`tsconfig.json`** - TypeScript configuration with loose rules (noImplicitAny: false, strictNullChecks: false)
- **`eslint.config.js`** - ESLint rules (allows unused variables and parameters)
- **`components.json`** - shadcn/ui configuration
- **`.env.local`** - Environment variables (e.g., `RESEND_API_KEY` for email functionality)

## Lovable Integration

This project was created with **Lovable** (lovable.dev), a web development tool. The project includes:
- **`lovable-tagger`** dependency - used for component tagging in development mode
- **`componentTagger()`** plugin in vite.config.ts - only activated in development mode

Lovable automatically commits changes when using their UI editor. When working locally, changes can be pushed to the repository and will be reflected in Lovable.

## Common Development Tasks

### Adding a New Route
1. Create a new page component in `/src/pages/`
2. Import it in `App.tsx`
3. Add a `<Route>` above the catch-all `*` route

### Adding a New Component
1. Create the component file in `/src/components/` (or `/src/components/ui/` if it's a reusable UI component)
2. Import and use it in pages or other components
3. Use existing shadcn/ui components as building blocks

### Using shadcn/ui Components
Components like Button, Card, Dialog, Form, etc. are pre-built in `/src/components/ui/`. Import them and compose them together. Customize via Tailwind classes or by editing the component source.

### Modifying the Contact Form
The Contact component in `/src/components/Contact.tsx` includes form validation with Zod. Keep the API endpoint (`/api/contact`) in sync with the request body structure.

## Deployment

The project is ready for deployment on **Vercel** (which provides serverless function support for the `/api` directory). The build command is configured in `package.json` as `vite build`.
