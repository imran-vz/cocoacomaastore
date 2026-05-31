# Cocoa Comaa Store Context

## Purpose

Cocoa Comaa Store is an internal ordering, inventory, and analytics system for Cocoa Comaa. It supports a point-of-sale/customer ordering flow, manager operations, and admin reporting.

The application should make day-to-day store work fast and clear:

- Create orders with desserts, combos, modifiers, customer name, and delivery cost.
- Track dessert inventory for each operating day.
- Let managers complete or cancel orders and maintain stock.
- Let admins review orders, users, products, UPI accounts, inventory changes, and analytics.
- Precompute analytics so dashboards stay responsive as order history grows.

## Product Surfaces

- Public/POS ordering:
  - Product grids and carts live under `src/components/*home*`, `src/components/cart*`, `src/components/product*`, and related form schemas.
  - Orders contain base desserts and optional modifier selections.
- Manager area:
  - Routes under `src/app/manager`.
  - Focused on operational workflows: orders, inventory, desserts, combos, and settings.
- Admin area:
  - Routes under `src/app/admin`.
  - Adds dashboard, analytics, order review, managers, UPI accounts, desserts, combos, and settings.
  - `src/app/admin/layout.tsx` protects admin routes with Better Auth session and `admin` role checks.

## Domain Vocabulary

- Dessert:
  - A sellable item in `desserts`.
  - `kind = "base"` means a primary dessert; `kind = "modifier"` means an add-on/modifier.
  - Desserts can be enabled/disabled, soft-deleted, out of stock, or unlimited stock.
- Combo:
  - A preset in `dessert_combos` with one base dessert and one or more modifier dessert items.
  - A combo may have an override price; otherwise price is computed from component items.
- Order:
  - A customer transaction in `orders`.
  - Relevant statuses are `pending`, `completed`, and `cancelled`.
  - Completed, non-deleted orders are the source of truth for revenue analytics.
  - Order lifecycle covers reading manager Orders, creating completed Orders, cancelling Orders, and the soft-delete cleanup path.
  - Cancellation is the normal operational path for reversing an Order.
  - Orders are expected to be finalized within the same operating day; changing an order after its day has passed is not a normal workflow.
- Order item:
  - A line in `order_items`, with snapshotted `unitPrice`.
  - Optional combo fields preserve combo identity after order creation.
- Order item modifier:
  - A persisted modifier selection in `order_item_modifiers`.
  - Modifier revenue is currently attributed as zero in dessert-level analytics unless sold as a base order item; modifier quantity is still counted.
- Cart line:
  - The canonical Order intake shape for POS carts.
  - Represents one base Dessert, optional modifier selections, optional Combo identity, snapshotted unit price, and line quantity.
  - Legacy base-only cart items should be adapted into cart lines before crossing the Order intake module interface.
- Daily inventory:
  - `daily_dessert_inventory` stores stock per dessert per day.
- Inventory audit log:
  - `inventory_audit_log` records stock mutations, including manual stock setting, order deductions, adjustments, and cancellations.
- Analytics:
  - Precomputed dashboard/reporting tables under `analytics_*`.
  - Live order tables remain the source of truth; analytics tables are derived.
- Admin reporting module:
  - The module that prepares Admin dashboard and Admin analytics reporting views.
  - It owns IST reporting boundaries, live-current-day reads, closed-day analytics reads, Business Week buckets, and chart-ready reporting shapes.
  - _Avoid_: Dashboard service, analytics API layer.
- Business Week:
  - A reporting week that runs Tuesday through Sunday in Asia/Kolkata.
  - Monday is not included in weekly revenue reporting.
  - _Avoid_: ISO week, calendar week.

## Technical Stack

- Next.js App Router with React client/server components.
- TypeScript.
- Node.js 24 with pnpm for package/runtime scripts.
- PostgreSQL with Drizzle ORM schema in `src/db/schema.ts`.
- Better Auth with the admin plugin.
- Recharts for chart rendering.
- Base UI/shadcn-style local UI primitives under `src/components/ui`.
- Biome for formatting/linting through:
  - `pnpm format`
  - `vp lint`
  - `vp run typecheck`

## Data Model Anchors

Core tables:

- `desserts`
- `dessert_combos`
- `dessert_combo_items`
- `orders`
- `order_items`
- `order_item_modifiers`
- `daily_dessert_inventory`
- `inventory_audit_log`
- Better Auth tables: `user`, `session`, `account`, `verification`
- Analytics tables:
  - `analytics_daily_revenue`
  - `analytics_daily_dessert_revenue`
  - `analytics_monthly_revenue`
  - `analytics_monthly_dessert_revenue`
  - `analytics_daily_eod_stock`
  - `analytics_daily_item_sales`

## Time And Reporting Rules

The business reporting day is based on Asia/Kolkata.

Use `src/lib/ist-date.ts` for day/month boundaries instead of ad hoc date math. Important helpers:

- `getStartOfDayIST`
- `getEndOfDayIST`
- `getAnalyticsDay`
- `getDayKey`
- `getISTMonthKey`
- `istMidnightToUTC`
- `pgTimestamp`

Analytics rows use normalized analytics day/month keys, while live order filtering uses the actual IST day bounds converted to UTC timestamps.

The business reporting week is Tuesday through Sunday in Asia/Kolkata. Store timestamps remain UTC; reporting buckets are calculated from localized IST boundaries.

Weekly dashboard trends are derived from daily analytics rows, not a separate weekly aggregate table. Monday is outside the Tuesday-Sunday weekly reporting bucket.

Monthly analytics are compiled after the reporting month closes: on the 1st of every month at 00:20 IST for the previous calendar month in IST.

Daily analytics are compiled after each reporting day closes: every day at 00:10 IST for the previous seven closed IST days. This is a defensive repair window for closed-day revenue, dessert revenue, end-of-day stock analytics, and the weekly dashboard trend.

The dashboard weekly trend keeps today's selected end date live when the end date is the current IST day; closed historical days come from daily analytics rows.

## Analytics Workflow

Analytics are precomputed from completed, non-deleted orders.

Batch workflow:

- Trigger.dev is the intended scheduler/orchestrator for recurring analytics compilation.
- The old direct compile CLI has been removed as an operational entry point.
- A CLI may remain as a thin on-demand helper that triggers a Trigger.dev job.
- On-demand analytics runs are developer/operator-only for now; there is no admin UI for triggering analytics jobs.
- Shared analytics compile logic lives in reusable TypeScript modules exposed as Effect programs.
- Jobs produce daily, monthly, dessert-level, and end-of-day stock analytics.

Inline recompute workflow:

- Library: `src/lib/recompute-day-analytics.ts`
- Entry point: `recomputeAnalyticsForDate(date)`
- Effect entry point: `recomputeAnalyticsForDateEffect(date)`
- Used after order mutations so affected day/month analytics stay fresh.
- Manager order mutations run analytics recompute and cache-tag invalidation through the Next-specific Effect runtime in `src/server/effect/next-runtime.ts`.

Cache invalidation:

- Order and inventory mutations revalidate relevant tags such as `orders`, `dashboard`, `analytics`, `inventory`, and `desserts`.

## Dashboard And Analytics UI

Admin dashboard:

- Page: `src/app/admin/dashboard/page.tsx`
- Client: `src/app/admin/dashboard/dashboard-content.tsx`
- Data actions: `src/app/admin/dashboard/actions.ts`
- Date switching uses `src/components/date-switcher.tsx`.
- Client-side date refresh goes through `src/app/api/admin/dashboard/route.ts`.
- Rapid date changes are protected with `AbortController` and a request id guard.
- Weekly revenue visualization uses revenue bars plus an orders line.

Admin analytics:

- Page: `src/app/admin/analytics/page.tsx`
- Client: `src/app/admin/analytics/analytics-content.tsx`
- Monthly revenue visualization also uses revenue bars plus an orders line.
- Per-dessert monthly revenue uses the selected month and a dessert table/pie distribution.

## Auth And Roles

- Better Auth configuration lives in `src/lib/auth.ts`.
- Server session helper: `getServerSession`.
- Admin routes require an authenticated session and `user.role === "admin"`.
- Manager routes require authentication and redirect admins back to admin surfaces.
- API routes that expose admin data should repeat auth/role checks; do not rely only on layout protection.

## Engineering Conventions

- Prefer existing server actions and UI primitives before adding new abstractions.
- Use Drizzle for structured DB access; raw SQL is acceptable for analytics aggregations where it is clearer and faster.
- Keep analytics derived from completed, non-deleted orders.
- Use IST helpers for all business-day and reporting-month calculations.
- Avoid stale UI updates when client interactions can create overlapping requests.
- Keep dashboard charts operationally readable; prefer familiar bars/lines over decorative chart concepts.
- When adding frontend controls, keep previous fast workflows intact.

## Open Questions

- Should modifier revenue be explicitly attributed when modifiers have price, or remain quantity-only in dessert-level analytics?
- Should `analytics_daily_item_sales` become the canonical item sales report surface, or is it reserved for future reporting?
- Should dashboard refresh API responses include a server-generated date key so the client can display which date the data belongs to?
- Should date switcher calendar availability reflect only dates with orders/inventory activity?
