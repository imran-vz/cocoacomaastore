# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js-based dessert store management system (Cocoacomaa Store) with role-based authentication, online/offline capabilities, and order management. Built with Next.js 15, React 19, TypeScript, Drizzle ORM, PostgreSQL (Neon), and better-auth.

## Essential Commands

### Development

```bash
pnpm dev                 # Start development server with Turbopack
pnpm build               # Build for production (includes service worker compilation)
pnpm build:sw            # Compile service worker TypeScript to JavaScript
pnpm start               # Start production server
pnpm lint                # Run Next.js linting
```

### Database Operations

```bash
pnpm db:generate         # Generate Drizzle migration files
pnpm db:migrate          # Apply migrations to database
pnpm db:push             # Push schema changes directly to database (dev only)
pnpm db:studio           # Open Drizzle Studio for database inspection
pnpm seed:admin          # Create initial admin user (admin@cocoacomaa.com / Q1w2e3r4t5*)
```

### Environment Setup

Required environment variables (see `.env.example`):

- `DATABASE_URL`: Neon PostgreSQL connection string
- `NEXT_PUBLIC_APP_URL`: Application URL (e.g., <http://localhost:3000>)
- `BETTER_AUTH_SECRET`: Generate with `openssl rand -base64 32`

## Architecture

### Authentication & Authorization

- **Library**: better-auth with Drizzle adapter
- **Strategy**: Email/password authentication (no email verification)
- **Roles**: `admin` and `manager` (default: manager)
- **Middleware**: Route protection in `src/middleware.ts`
  - Public routes: `/login`, `/api/auth/*`
  - Admin-only routes: `/admin/*`
  - Manager routes: `/(manager)/*` (root, `/orders`)
- **Auth configuration**: `src/lib/auth.ts` (server), `src/lib/auth-client.ts` (client)

### Database Schema (`src/db/schema.ts`)

Core tables:

- `desserts`: Products with price, description, soft delete, enabled flag, sequence for ordering
- `orders`: Customer orders with status (pending/completed), delivery cost, soft delete
- `order_items`: Order line items with dessert references
- `upi_accounts`: UPI payment accounts with enabled flag and sequence
- Auth tables: `user`, `session`, `account`, `verification` (better-auth managed)

### Route Structure

```text
src/app/
├── (manager)/           # Manager role routes with layout
│   ├── page.tsx        # Main store interface (home)
│   └── orders/         # Order management
├── admin/              # Admin-only routes with separate layout
│   ├── desserts/       # Manage desserts (CRUD)
│   ├── managers/       # Manage manager accounts
│   └── upi/            # Manage UPI accounts
├── desserts/           # Shared dessert data actions
├── login/              # Authentication page
└── api/auth/[...all]/  # better-auth API routes
```

### Server Actions Pattern

Server actions are co-located in `actions.ts` files within route directories:

- Actions use `"use server"` directive
- Common pattern: cached getters (unstable_cache) and mutations with revalidatePath
- Example: `src/app/desserts/actions.ts` exports `getCachedDesserts()`
- Admin actions typically include delete operations and enable/disable toggles

### Service Worker & Offline Support

- **Location**: `src/app/sw.ts` (compiled to `public/sw.js` during build)
- **Build process**: TypeScript compiled separately via `build:sw` script
- **Caching strategies**:
  - Network-only: HTML pages, API requests (no caching for dynamic data)
  - Cache-first: Images, static assets (JS, CSS, fonts)
- **Cache versions**: Static cache and image cache with version prefixes
- **Components**:
  - `OfflineIndicator`: Shows online/offline status
  - `ServiceWorkerProvider`: Manages service worker registration

### Key Components

- `src/components/home.tsx`: Main store interface with cart, dessert list, and receipt
- `src/components/bill.tsx`: Bill display with UPI QR code generation
- `src/components/cart.tsx`: Shopping cart with quantity management
- `src/components/receipt.tsx`: Order receipt display
- Server/Client split: Pages are server components fetching data, client components handle interactions

### Data Flow

1. Server components fetch data using cached server actions (Promise patterns)
2. Data passed to client components via props
3. Client components manage local state (cart, forms)
4. Mutations trigger server actions with `revalidatePath()` for cache invalidation
5. Optimistic updates used in admin interfaces (e.g., dessert sequence reordering)

## Important Patterns

### Soft Deletes

Tables use `isDeleted` boolean flag instead of hard deletes. Always filter by `isDeleted: false` in queries.

### Sequence Management

Desserts and UPI accounts use `sequence` integer field for custom ordering. Batch updates available for reordering (see `batchUpdateDessertSequences`).

### Form Validation

- Zod schemas for validation
- React Hook Form with `@hookform/resolvers/zod`
- Form schemas typically in `form-schema/` directories

### Type Safety

- Shared types in `src/lib/types.ts`
- Database types inferred from Drizzle schema
- Auth session types from `src/lib/auth.ts` exports

## Build Process

1. Service worker TypeScript compiles first (`build:sw`)
2. Next.js build runs with Turbopack in dev
3. Static assets cached by service worker on install
4. Progressive Web App (PWA) capabilities via manifest

## Development Notes

- Package manager: pnpm 10.15.1 (enforced)
- Only specific dependencies should be built: @tailwindcss/oxide, bufferutil, esbuild, bcryptjs, sharp
- Uses Next.js App Router with React Server Components
- Styling: Tailwind CSS 4.x with custom configuration
- UI components: Radix UI primitives with shadcn/ui patterns
