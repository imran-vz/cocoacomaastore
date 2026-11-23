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
  - The Sell screen lives in `src/features/pos`; both areas' Sell routes render its `SellPage`.
  - Orders contain base desserts and combos; a combo's modifier selections come from the combo.
- Manager area:
  - Routes under `src/app/manager`.
  - Focused on operational workflows: orders, inventory, desserts, combos, and settings.
- Admin area:
  - Routes under `src/app/admin`.
  - Adds dashboard, analytics, order review, managers, UPI accounts, desserts, combos, and settings.
- Shell:
  - `src/features/shell` owns the staff chrome for both areas: the route map (`routes.ts`, from which tabs, the More sheet, the account menu, the admin sidebar, breadcrumbs, back links, settings rows, section switches and each screen's content width derive), `AppShell` (used by both area layouts; it signs the visitor in or redirects, and shows the database-down screen), and the Settings screen.
  - Each route has its own loading boundary (`loading.tsx`) whose skeleton comes from the feature it mirrors. Each area's root `loading.tsx` shows the neutral `RouteSkeleton`, which Next falls back to while the target route's own boundary hasn't been fetched yet (always in dev, and on a tap before prefetch lands).
- Staff accounts: `src/features/staff` (the Managers settings screen; admins add and delete staff accounts; the first-administrator bootstrap in `bootstrap/`, run by `pnpm auth:bootstrap-admin`).
- UPI accounts: `src/features/upi` (the admin settings screen and the guarded checkout reader the POS uses).

## Domain Vocabulary

- Catalog:
  - Desserts and Combos, owned by `src/features/catalog` (reads, the one actions file, shared zod schemas used by both the forms and the server, selling rules, and the Desserts/Combos screens). Admin and manager pages only pass `area` for links.
- Dessert:
  - A sellable item in `desserts`.
  - `kind = "base"` means a primary dessert; `kind = "modifier"` means an add-on/modifier.
  - Desserts can be enabled/disabled, soft-deleted, out of stock, or unlimited stock.
  - Names are unique (ignoring case) among undeleted desserts; a deleted dessert's name can be reused.
  - `sequence` is the Sell-screen order. New desserts go last; only desserts on sale are moved, and hidden ones keep their places.
- Combo:
  - A preset in `dessert_combos` with one base dessert and one or more modifier dessert items.
  - A combo may have an override price; otherwise price is computed from component items.
  - A combo and its items are saved together in one transaction; the server checks the base is `kind = "base"` and every item is a modifier.
- Order:
  - A customer transaction in `orders`, owned by `src/features/orders`: `contract.ts` (request schemas, limits tied to the columns they fit, the wire shape `OrderRecord`/`DayOrders`, the cancel rule), `sale.ts` (the `ORDER_STATUS` vocabulary and the sale rule), `presentation.ts` (the one display model the Orders page and the invoice PDF share), `lifecycle.ts` (create and cancel, taking and restoring stock through the inventory ledger), `queries.ts` (`getDayOrders`), and the one `actions.ts` (`createOrder`, `cancelOrder`).
  - Orders are saved as `completed` and may later become `cancelled` (`ORDER_STATUS` in `orders/sale.ts`). Nothing writes `pending`, though the column allows it.
  - A sale is a completed, non-deleted order (`SALE_STATUS`/`isSale` in `orders/sale.ts`, which Insights also uses). Revenue is the sum of sales' totals, delivery included, on the Orders page and in Insights alike.
  - Any staff member can create Orders and cancel today's Orders; today's Orders are readable by all staff, earlier days by admins only.
  - Cancellation is the sole operational path for reversing an Order, and is only allowed on the shop day the Order was placed (`canCancelOn`); the Orders page applies the same rule to the server's `today`.
  - Admins and managers share one Orders page (`OrdersPage`; the area decides day browsing and the Revenue metric) and one client query (`dayOrdersQuery` over `/api/orders?date=`), which Insights' sales by hour reuses.
  - Saving is idempotent per `submissionId`: a retry of the same request replays the saved Order; the same id with a different request is refused.
  - Failures staff can act on (stock shortage, item off sale, already cancelled, past day, conflict) come back as `{ ok: false, error }` with the message to show.
- Order item:
  - A line in `order_items`, with snapshotted `unitPrice`.
  - Optional combo fields preserve combo identity after order creation.
- Order item modifier:
  - A persisted modifier selection in `order_item_modifiers`.
  - Modifier revenue is currently attributed as zero in dessert-level analytics unless sold as a base order item; modifier quantity is still counted.
- Cart line:
  - The POS cart shape: one Dessert, or one Combo on its base Dessert, with a display unit price and a quantity. A cart has at most one line per Dessert and per Combo.
  - A line uses its base Dessert's stock; what a Sell tile shows as left is today's count less what the cart already uses.
  - Saving sends only references (`baseDessertId`, optional `comboId`, `quantity`); the server prices every line from the catalog.
- Daily inventory:
  - `daily_dessert_inventory` stores stock per dessert per shop day, owned by `src/features/inventory`.
  - Staff set absolute counts; each count carries the stored count it was typed over, and a save whose stored counts moved meanwhile (an order, another device) is rejected as a conflict with nothing written.
  - Every screen showing today's stock (Sell, Catalog, Stock) shares one client query through `useTodayInventory`.
- Inventory audit log:
  - `inventory_audit_log` records stock mutations: stock counts (`set_stock`), order deductions (`order_deducted`) and cancellations (`order_cancelled`), all written through `inventory/stock-ledger.ts`. The column also allows `manual_adjustment`, which nothing writes any more; Insights still labels such rows "Manual".
  - A row belongs to the shop day whose stock it changed (its `day` column; for an order's rows, the order's day), not the instant it was written. Insights › Day lists the latest 50 rows of a day with the day's total count, and the end-of-day stock compile reads the same rows.
- Analytics:
  - Precomputed dashboard/reporting tables under `analytics_*`.
  - Live order tables remain the source of truth; analytics tables are derived.
- Insights:
  - The admin reporting surface: Insights › Day (`/admin/dashboard`) and Insights › Month (`/admin/analytics`), plus the analytics compile jobs behind them.
  - Lives in `src/features/insights/`. Its reads return keyed, zero-filled series (`DayKey`/`MonthKey`/Business Week index plus numbers); the client formats every label.
  - _Avoid_: Dashboard service, analytics API layer.
- Items sold:
  - The sum of order line quantities on completed orders, as the Orders page and the cart count them. A combo is one item; its modifiers are not counted again.
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
- Biome for formatting/linting through `pnpm format` and `pnpm lint`; TypeScript checks through `pnpm typecheck`.

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

Use `src/lib/shop-calendar.ts` for shop days and months instead of ad hoc date math: `DayKey` (`YYYY-MM-DD`) and `MonthKey` (`YYYY-MM`) strings, `dayKeyOf`, `monthKeyOf`, `parseDayKey`/`parseMonthKey`, `dayStart`/`dayEnd`, `monthStart`/`monthEnd`, `addDays`/`addMonths`, `daysBetween`, `monthFirstDay`/`monthLastDay`, `analyticsDate`, `shopParts`. Client code uses shop days too: "today" is `dayKeyOf(new Date())`, never the browser's local date.

Analytics rows use normalized analytics day/month keys, while live order filtering uses the actual IST day bounds converted to UTC timestamps.

The business reporting week is Tuesday through Sunday in Asia/Kolkata. Store timestamps remain UTC; reporting buckets are calculated from localized IST boundaries.

Weekly dashboard trends are derived from daily analytics rows, not a separate weekly aggregate table. Monday is outside the Tuesday-Sunday weekly reporting bucket.

Monthly analytics are compiled after the reporting month closes: on the 1st of every month at 00:20 IST for the previous calendar month in IST.

Daily analytics are compiled after each reporting day closes: every day at 00:10 IST for the previous seven closed IST days. This is a defensive repair window for the closed days' compiled rows, which feed the day trend and Business Weeks.

Every Insights read decides live vs closed once per request from the current shop day: closed days come from daily analytics rows and today is read live from the orders. Items sold for the selected day is always read from the order lines, so a day shows the same count before and after it closes.

## Analytics Workflow

Analytics are precomputed from completed, non-deleted orders.

Batch workflow:

- Trigger.dev schedules and runs analytics compilation (`src/trigger/analytics.ts`).
- `pnpm analytics:trigger:daily` / `pnpm analytics:trigger:monthly` (`scripts/trigger-analytics.ts`) trigger a run on demand; they do not compile anything themselves. There is no admin UI for triggering analytics jobs.
- The compile logic is Effect programs in `src/features/insights/compile.ts` and `jobs.ts`; `runAnalyticsJob` runs them with the database and the cache revalidator.
- Jobs write daily and monthly revenue, daily and monthly per-dessert revenue, and daily end-of-day stock. A day or month is recompiled in one transaction.
- Insights reads only daily revenue, monthly revenue and monthly per-dessert revenue. Daily per-dessert revenue (`analytics_daily_dessert_revenue`) and end-of-day stock (`analytics_daily_eod_stock`) are compiled but not shown anywhere yet; `analytics_daily_item_sales` is never written.
- Jobs stop before compiling, without retrying, when `NEXT_PUBLIC_APP_URL` or `REVALIDATE_SECRET` is missing, because compiled reports would otherwise stay hidden behind cached ones. After compiling they POST `{ secret }` to `/api/revalidate` (contract in `src/features/insights/revalidate-request.ts`, handler in `revalidate-endpoint.ts`), which expires Insights' compiled-analytics tags (`COMPILED_TAGS`) at once (`{ expire: 0 }`), so the next read gets the new report rather than a stale copy. The app must be deployed before a job that sends this body: an older endpoint also wants a `tag`.

Mutation and compilation boundary:

- Order creation and same-day cancellation update source-of-truth order, inventory, and audit rows, then expire the day's cache tags (`writeAndRefresh`). Analytics are not recompiled.
- Current IST-day dashboard metrics and chart points read live source tables.
- The Trigger.dev daily task runs at 00:10 IST and recomputes the previous seven closed IST days from source truth.
- Interactive cancellation is limited to the current operating day, so it cannot change closed historical analytics.
- Operators can request repair of the current seven-day closed window through the existing authenticated Trigger path.

Cache invalidation:

- Order and inventory mutations synchronously invalidate tags for the affected IST day before their request completes. Closed-period reporting caches are invalidated by analytics compilation and relevant catalog edits; broad domain tags remain available for explicit refreshes.

## Cache Tags And Client Queries

- `src/lib/cache-tags.ts` is only the vocabulary: the base tags (`CacheTag`, `ALL_CACHE_TAGS` for Refresh data) and the `TAGGED_READ_REVALIDATE_SECONDS` backstop. Each feature's `tags.ts` owns what its reads carry and what its changes refresh, and server `unstable_cache` reads and client queries (`meta.tags`) use the same builders:
  - orders: `dayOrdersTags(day)`, and `orderChangeTags(day)`, which adds inventory's `stockChangeTags(day)` because orders move stock;
  - inventory: `dayInventoryTags(day)`, `stockChangeTags(day)`;
  - insights: `dayReportTags(day, today)`, composed from the orders and inventory builders, and `isLiveDay(day, today)`, the one rule for which days read today live (their tags, cache key and `isLive`); `COMPILED_TAGS`, `DESSERT_SALES_TAGS`;
  - catalog (`DESSERT_TAGS`, `COMBO_TAGS`, `COMBO_READ_TAGS`), staff (`STAFF_TAGS`), upi (`UPI_TAGS`).
- Server actions report what they refreshed. Tags expired with `updateTags` (`src/server/next-cache.ts`, which `writeAndRefresh` uses) inside a `staffAction`/`adminAction` come back on its result as `refreshed`. The client runs actions with `useRunAction()` (`src/lib/action-result.ts`), which invalidates the queries carrying those tags (`invalidateTags`) and, by default, resolves once they have refetched; `refetch: "background"` (Sell screen saves) resolves at once. Clients never name the tags an action refreshed; a failed change that was shown ahead of its save reloads its own query.
- API routes that answer a read are one line: `snapshotRoute(staffRoute | adminRoute, read, { param, parse }?)` (`src/features/access/route.ts`) answers a `ServerSnapshot` (`{ data, readAt }`) and 400 for a missing or invalid key. Each feature's `client.ts` builds its queries with `snapshotQuery<T>(url, { queryKey, tags })` (`src/lib/snapshot-query.ts`), and pages seed them with `useSeededQuery`.
- A failed route read throws an `HttpError` carrying its status (`src/lib/fetch-json.ts`). The query client (`src/components/providers.tsx`) does not retry 401/403, and on a 401 (the session ended) sends the visitor to sign in.

## Dashboard And Analytics UI

Both pages are thin routes over `src/features/insights/`:

- Server reads (admin-guarded, cached by tag): `reporting.ts`. Client-safe types: `shapes.ts`. Pure series and Business Week bucketing: `series.ts`.
- Client: `dashboard-content.tsx` (Day) and `analytics-content.tsx` (Month), fetching through `client.ts` and the API routes under `src/app/api/admin/dashboard` and `src/app/api/admin/analytics/*`.
- Date switching uses `src/components/ui/date-switcher.tsx`, which works in shop `DayKey`s up to the `today` its page got from the server (Day takes it from its live report and moves on at midnight).
- Only compiled months can be opened into Business Weeks, so weeks are read from compiled days only; today's live sales reach Insights › Day, not Month.
- Server reads use the shared `TAGGED_READ_REVALIDATE_SECONDS` backstop like every other tagged read: every input of an Insights read is tagged (orders and stock by day, desserts, compiled analytics), so a shorter expiry would only hide a missing invalidation.
- Rapid date changes are handled by React Query: each day is its own query, and superseded requests are aborted through the query's `AbortSignal`.
- Revenue charts (`revenue-chart.tsx`, ADR 0009) are revenue bars with one selected bar; a phone renderer and a Recharts renderer share the scale and colours, and the chart card's width (not the viewport) picks between them. Orders appear in the tooltip and the summary under the chart. A trend needs at least two slots with sales (`hasTrend` in `chart-slots.ts`).
- Per-dessert monthly revenue is a ranked list of top desserts for the selected month.

## Auth And Roles

- `src/features/access` owns sign-in and access: Better Auth (`auth.ts`, `auth-client.ts`, whose `authFailureMessage` words every failed auth request), the sign-in screen (`sign-in-page.tsx`, rendered by `src/app/login`), the two staff areas (`area.ts`: Better Auth's `admin` role works in `/admin`, every other account in `/manager`) and the shared password rule (`password.ts`). The first-administrator bootstrap lives with staff accounts (`src/features/staff/bootstrap/`).
- Session: `getStaffUser()` reads the signed-in staff member once per request. Every entry point checks it once, with the helper for its kind:
  - Layouts: each area layout's `AppShell` calls `requireArea(area)`, which redirects visitors to sign in and staff to their own area. Pages call it only when they need the user (Settings); pages such as Insights are protected by their data reads.
  - Server actions: every export of a `"use server"` file is built with `staffAction` (any signed-in staff member) or `adminAction` (admins only) from `action.ts`, and returns `{ ok: true, data }` or `{ ok: false, error }` with a message staff can act on.
  - API routes: `staffRoute` / `adminRoute` from `route.ts` answer 401/403. `/api/revalidate` is the exception: the analytics job calls it with `REVALIDATE_SECRET` instead of a session.
  - Data reads used by pages check access themselves (`requireStaff` / `requireAdmin`), so layouts are never the only protection.
- `src/features/access/entry-points.test.ts` calls every server action and API route signed out (the revalidate route without its secret) and fails if any of them does work first.
- Staff work (POS, orders, stock, catalog) is one action per operation for both areas; reporting, staff accounts, UPI accounts and past days' orders are admin-only.
- POS cart:
  - `usePosCart` (`src/features/pos`) owns the Cart lines, the customer and delivery fields, totals, refusals, and saving; `cart.ts` and `checkout.ts` hold its rules.
  - The cart sheet and the inline cart panel are layouts over it, sharing its fields, line list and footer.
  - _Avoid_: cart rules, copy text, UPI note generation or save ordering inside a cart layout.

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
- Compiled tables nobody reads: should Insights show daily per-dessert revenue (`analytics_daily_dessert_revenue`) and end-of-day stock (`analytics_daily_eod_stock`), or should the jobs stop writing them? Should `analytics_daily_item_sales` (never written) be dropped?
- Should date switcher calendar availability reflect only dates with orders/inventory activity?
