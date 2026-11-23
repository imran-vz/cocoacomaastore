# Cocoa Comaa design contract

Cocoa Comaa is a mobile-first PWA for the people behind the counter. A phone at 390px is the main screen. 360px must not break. Tablet (820px) and desktop (1440px) must stay good, and admin desktop keeps its sidebar.

This file is the contract. `src/lib/design-contract.test.ts` checks the parts that can be checked statically. Change this file and the test together.

## Signature

- **Primary:** chocolate brown `oklch(0.33 0.06 31.42)`. Use it for primary actions, the selected state, the brand lockup and data series. Everything else is warm neutral.
- **Brand mark** (`src/components/brand-lockup.tsx`):
  - `BrandLogo`, the photo logo (`/logo.png`, cropped to its ink ring in a circle), at every size: 32px in the app bar, sidebar header and collapsed rail, 48px in empty states, 72px in the sign-in hero.
  - The PWA icon files are the owner's assets and are unchanged.
- **Brand lockup:** the mark with the "Cocoa Comaa" wordmark in primary.
- **Type:** Nunito Sans for everything, numbers included.
- **Texture:** one page layer, `.page-texture` (`globals.css`), on each shell root and the sign-in page. It draws the cocoa ring pattern (`/page-texture.svg`) at `--texture-opacity`.
  - **Clearly visible** in a top band behind the app bar and page header, fading out by `--texture-band` (240px), and in the outer gutters beside the content column on wide screens.
  - **Faint** (`--texture-floor` of full strength) behind content further down.
  - The app bar and admin header are transparent over the band at rest and turn opaque, with their hairline, once content scrolls beneath them.
  - Every card, list, sheet, chart and form surface on top of it is opaque. Don't add another background image for the texture anywhere else.

## Colour

All colour comes from tokens in `src/app/globals.css`. Raw Tailwind hues such as `text-green-600` or `bg-blue-100` are not allowed in `src/components` or `src/app`.

| Token | Use |
| --- | --- |
| `background` | Page background (warm off-white, under the grid) |
| `card`, `popover` | Every surface on top of the page |
| `foreground` | Body text and titles |
| `muted`, `muted-foreground` | Quiet surfaces (tracks, tiles, disabled fills) and secondary text. Meets 4.5:1 on background, card and muted |
| `border`, `input` | Hairlines and field borders |
| `accent` | Hover and pressed surfaces |
| `primary`, `primary-foreground` | Primary action, selection, brand |
| `success`, `warning`, `info`, `destructive` (+ `-foreground`) | Status only |
| `chart-1` … `chart-5` | Data: primary, caramel, light cocoa, then two warm neutrals |

- **Neutrals** sit at hue 40–75 with chroma ≤ 0.03, the same temperature as the brown. The test checks this.
- **Status colours** are for status only: badges, deltas against a real comparison, and validation. They are never used for section headings, decorative icons, "∞" glyphs or "Best day" labels.
- **Charts:** a single series uses one hue (`chart-1`, or `primary` for the selected bar with `primary/20` for the rest). A comparison uses `primary` against `muted-foreground/40`. Ranked lists use one hue, not a colour per category.
- **Contrast floors** are enforced by the test: foreground ≥ 7:1, muted text ≥ 4.5:1, and status and primary text ≥ 4.5:1 on card.

Dark tokens exist so the theme still compiles. Dark mode is not designed yet.

## Type

| Role | Size / weight | Notes |
| --- | --- | --- |
| Page title | 22/700 on phones, 26/700 from `md` | Comes from `PageHeader`; equals the nav label |
| Section heading | 15/600 foreground, sentence case | Comes from `SectionHeading`. A count follows in muted text, e.g. "Available 11" |
| Row title | 15/600 | Comes from `ListRow` |
| Body | 15–16 | Inputs use 16px on phones so iOS doesn't zoom |
| Meta | 13 muted | Join parts with " · " |
| KPI value | 24–28/700, tabular | The label under it is 13 muted, sentence case |

- **Sentence case everywhere:** titles, labels, buttons, menu items and tabs. Write "Add dessert", "Save stock", "Avg order value". Acronyms such as UPI, QR and PDF stay upper case.
- **No emoji** in copy or headings.
- **No coloured headings.** A heading is never green, red or teal, and never brand-coloured.

## Numbers and formatting

`src/lib/format.ts` is the only place that formats something for display. Components never call `toFixed`, `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString`, and never build `₹` or `Rs` strings themselves.

| Helper | Output |
| --- | --- |
| `formatINR(v)` | `₹7,750`, `₹92.50`, `₹12,00,882`. Uses `en-IN` lakh grouping. With the default `paise: "auto"`, whole rupees show no decimals |
| `formatINR(v, { paise: "always" \| "never" })` | `₹80.00` / `₹93` |
| `formatINRCompact(v)` | Chart axes and tight tiles: `₹950`, `₹7.8K`, `₹12L` |
| `formatNumber(n)` | `1,23,456` |
| `formatPercent(ratio, digits?)` | `42%` |
| `formatCount(n, unit)` | `75 sold`, `5 items`, `1 item`, `3 changes`. Never "Nos" |
| `formatTime(d)` | `12:30 AM` |
| `formatDate(d)` | `23 Nov 2026` |
| `formatDateShort(d)` | `23 Nov` |
| `formatDayHeading(d)` | `Monday, 23 November` |
| `formatDayShort(d)` | `Mon, 23 Nov` |
| `formatDateTime(d)` | `23 Nov 2026, 12:30 AM` |
| `formatMonth("2026-09")` | `September 2026`. Month selects show this, never `2026-09` |
| `formatMonthShort("2026-09")` | `Sep`, never "Sept" |
| `roleLabel(role)` | `admin` → "Admin", anything else → "Manager" |
| `formatInitials(name)` | `CA`, `CM`, taken from the name's words |

- **Time zone:** every date and time shows in shop time (`Asia/Kolkata`). A `YYYY-MM-DD` key is treated as a calendar day, with no time-zone shift.
- **Figures:** numbers use the UI sans with tabular figures (`tabular-nums`, or the `num` utility).
- **`font-mono`** is only for UPI IDs and copied receipt text. Order numbers, times and totals are never monospace.

## Touch

- **Hit area:** below `md`, every interactive control has a hit area of at least 44×44. This covers buttons, icon buttons, steppers, switches, checkboxes, date arrows, the sidebar trigger, the password eye and menu triggers. Compact sizes are allowed from `md` up.
- **`Button`:**
  - `default` is 44px tall on phones and 36px from `md`.
  - `lg` is 48 on phones and 40 from `md`.
  - `icon` is 44 on phones and 36 from `md`.
  - `icon-touch` is 44 at every width. Use it for app-bar actions, steppers and row actions.
  - `sm`, `xs`, `icon-sm` and `icon-xs` keep their small look but get an invisible 44px hit box below `md`.
- **Inputs:** `Input` and `SelectTrigger` are 44px with 16px text on phones and 36px / 14px from `md`. Values are `text-foreground`. Placeholders are only for empty fields and never carry rules. Put rules in helper text below the field.
- **Menus and toggles:** `DropdownMenuItem` and `SelectItem` rows are 44px on phones. `Switch` is 24×40 on phones and 18×32 from `md`. `Checkbox` is 20px on phones. Both reach 44px through their hit area.
- **Close buttons:** the close button in `Sheet` and `Dialog` is 44px on phones.

## Focus

There is one keyboard focus ring: a 2px solid `--focus-ring` (primary at 60%) with a 2px offset. Primitives get it from the `focus-ring` utility. Plain links, rows and anything with `tabindex` get it from the base layer. Don't add `ring-3` or a custom focus style.

A control that sits inside a field (the password eye) draws the same ring inset (`focus-visible:outline-offset-[-5px]` on a rounded button), so it never overlaps the field's corner.

The plan asked for primary at 40%. That measures about 2:1 on the cream page, so the ring uses 60% to stay visible.

## Disabled

A disabled control is quiet; it does not turn into a new colour, and it does not fade with opacity.

- **Filled buttons** (default, secondary, destructive) become `bg-muted text-muted-foreground`.
- **Outline buttons** keep their surface and mute their text.
- **Inputs** become `bg-muted text-muted-foreground`.
- **Switches** use a muted track.
- **Exceptions:** a button that is busy (`aria-busy`) or flashing success or error keeps its colour, so the feedback stays readable.

`disabled:opacity-*` is not allowed in `src/components` or `src/app`.

## Badges

Badges are neutral by default, and colour means status.

- **Routine states get no badge.** A completed order, an enabled UPI account and a role all render as plain muted text.
- **Colour is for exceptions only:** `destructive` (Cancelled, Disabled, Out of stock), `warning` (Low), `success` and `info`.
- **`brand`** is a primary tint for a featured or selected marker. It is not a status.
- **Other neutral badges:** `default`/`secondary` are neutral, and `outline` is neutral with a border.

## Layout

- **Two frames** (`PageFrame`, `src/components/page-frame.tsx`; admin pages use `AdminPageShell frame`):
  - `narrow` (max-w-3xl): lists and forms — Catalog, Stock, Settings, Managers, UPI accounts.
  - `wide` (max-w-7xl, default): data — Sell, Orders, Insights.
  - **Left-aligned** to the page title's edge. A frame is never centred inside the admin inset, and a page never adds its own `mx-auto max-w-*` column. Manager pages pass `centered`: the 7xl column is centred under the manager top bar and narrow content stays left-aligned inside it.
- **Content width, not viewport.** The shell's page region (`AppMain`) is the `@container/main` size container. Every list↔table switch and every multi-column layout inside a page queries it: `@3xl/main:hidden` / `hidden @3xl/main:block`, `@2xl/main:grid-cols-2`. Viewport breakpoints (`md:`) are for the shell itself (bars, sidebar, gutters, type scale), not for what's inside a page. Admin at 820px with the sidebar open has ~540px of content, so it gets the list.
- **Height:** page roots use `min-h-app` = `100dvh − --app-bar-height − --bottom-nav-height` (minus the admin inset's own margin from md). A short page never scrolls, not even by 1px. Don't use `100vh` or `min-h-screen` inside the shell.

## Page header

Every page starts with `PageHeader` (`src/components/ui/page-header.tsx`).

- **Title:** equals the nav label, in sentence case. Its `<h1 data-app-title>` lets the mobile app bar show the title only after the heading scrolls away.
- **Description:** one muted line (optional).
- **Primary action:** one, on the right, built with `PageHeaderAction`. It is a 44px icon button on phones and has an icon and a label from `md`. If the page registers that action in the mobile app bar (`<AppBar action>`), pass `actionPlacement="desktop"` so it renders only once.
- **`secondary`:** quiet extras such as a `⋯` overflow menu. Destructive bulk actions like "Hide all desserts" live there, behind a `ConfirmSheet`.
- **`children`:** one row under the title, such as a segmented control, a date switcher or a search field.

## Records

A table renders only when the **content** is wide enough: below `@3xl/main` (768px of content), records use `RecordList` + `ListRow` (`src/components/ui/list-row.tsx`); from `@3xl/main`, `Table` may take over. Never switch records on `md:` — with the admin sidebar open, a viewport breakpoint shows a table in a column too narrow for it (§Layout).

- **`RecordList`:** one bordered card with divided rows.
- **`ListRow`:**
  - an optional 40px `ListRowTile` (initials or an icon)
  - a title (15/600, up to two lines)
  - meta (13 muted, wraps)
  - a right-aligned `trailing` value (tabular) with optional `trailingMeta` (a status word or badge)
  - an optional `action` outside the tap area (a 44px icon button, a `Switch` or a `⋯` menu)
  - a chevron when the row has `href` or `onClick`
  - a minimum height of 56px
- **`ListSection`:** a `SectionHeading` with a count, then the list.
- **Hidden or disabled records** use normal text plus a muted "Hidden" label. Don't stack strikethrough on top of opacity.
- **"Unlimited"** stock is written as the word in muted text, not a coloured ∞.

## Segmented control

`src/components/ui/segmented-control.tsx` has one look for two jobs: a warm-grey track with the selected segment raised on `card` in primary text, 44px tall on phones.

- **`SegmentedControl`** chooses a value. Use it for the Available | Hidden filter, the payment method and UPI accounts. It is a radio group with arrow-key navigation, and segments can show a muted count.
- **`SegmentedLinks`** switches between sibling pages, such as Desserts | Combos on Catalog and Day | Month on Insights. It uses links with `aria-current="page"`. The date itself lives in one date stepper ("Today · 23 Nov"), never in the section control as well.

Use a segmented control instead of stacked tables, native `<select>`s or a select over a select.

## Save bar

`SaveBar` (`src/components/ui/save-bar.tsx`) appears only while a form has unsaved changes. It shows "3 changes", a ghost "Discard" and the primary save action ("Save stock").

- **Phones:** it is fixed directly above the bottom tab bar (`bottom-above-nav`, read from `--bottom-nav-height`) and is safe-area aware (`pb-safe-above-nav`). It adds a spacer, so the last rows of the page stay reachable.
- **`md` and up:** it is a sticky floating card at the bottom of the content column.
- **Save action:** it only moves the existing save trigger. Pass the existing handler, or your `ReactiveButton` via `saveButton`.

## Overlays

Every overlay is a real modal: the cart sheet, the More sheet, form sheets, `ConfirmSheet` and the date picker.

- **Focus is trapped** while open and the page behind is inert (Tab and Shift+Tab never reach it; it can't be clicked).
- **Initial focus:** Close (cart), the first field (forms; a touch open focuses the sheet instead so the keyboard doesn't pop), the safe action (confirmations).
- **Return:** focus goes back to the trigger on Escape, close and swipe. If the trigger is gone (the last cart line was removed), it goes to the nearest stable control (the search field).
- **How:** `Sheet`, `Dialog`, `ConfirmSheet` and `FormSheet` get all of this from Base UI; pass `initialFocus` / `finalFocus` when the default target is wrong. A hand-built overlay (the POS cart sheet, for its drag gesture) uses `useModalFocus` (`src/components/ui/use-modal-focus.ts`).
- **Shape:** below md, overlays are bottom sheets (rounded top, grabber, safe-area padding). From md, forms and confirmations are centred dialogs.

## Confirmations

`ConfirmSheet` (`src/components/ui/confirm-sheet.tsx`) is the only destructive confirmation. `window.confirm`, `alert` and `prompt`, popovers and ad-hoc dialogs are not allowed.

- **Shape:** a bottom sheet over a scrim below md, an alert dialog from md.
- **Copy:** the title is a question naming the thing ("Delete Council Manager?", "Cancel order #5008?"), then one muted line on the consequence. Use the optional slot for an input the action needs (the cancel reason, with the shared `Select` or `SegmentedControl`).
- **Buttons:** a full-width solid destructive confirm (48px on phones) with a verb + noun label ("Delete manager", "Cancel order"), then a ghost safe action ("Cancel", or "Keep order" where "Cancel" would be ambiguous). Focus starts on the safe action. While the action runs, the confirm button shows its busy label and the sheet can't be dismissed. An error stays in the sheet.
- **Scope:** only actions that destroy or hide stored data: delete manager, delete UPI account, cancel order, hide all desserts, delete dessert, delete combo, and discarding a dirty form. Nothing else gains a confirmation.
- **Imperative guard:** `const ok = await confirmSheet.ask({...})` from `useConfirmSheet()`, with `{confirmSheet.element}` rendered once.

## Forms

Add and edit forms (dessert, combo, manager, UPI account) use `FormSheet` (`src/components/ui/form-sheet.tsx`).

- **Shape:** a full-height bottom sheet below md, a centred dialog from md, with the same header at every width: `✕ · Title · [⋯] [primary]`. The primary stays in the header so it is always in one place and above the phone keyboard. The form body scrolls.
- **Dirty-aware:** the primary ("Save", "Add") is disabled until a field differs from its initial value. Closing a dirty form with ✕, Escape or the scrim asks "Discard changes?" (Discard / Keep editing). Closing after a successful save never asks.
- **Destructive actions** (Delete dessert, Delete combo) sit behind the `⋯` in the header and open a `ConfirmSheet`. They never sit next to Save.
- **Helper text** for rules goes under the field, never in a placeholder.

## Empty states

`EmptyState` (`src/components/ui/empty-state.tsx`) is the only empty or zero state.

- **`inline`** (default): one muted line in a card, for a section or filter with nothing in it ("No stock changes on this day.", "No hidden combos.").
- **`block`:** the brand logo, a title and one line, centred, for a whole screen or pane with nothing to do ("Nothing to count today", the empty cart). One optional action under it.
- **`framed={false}`** when it already sits inside a card or list.
- No dashed borders, icon circles, illustrations or coloured headlines. Don't list rows that offer no action (Stock collapses unlimited desserts into one "11 desserts have unlimited stock ›" row).

## Shell (summary; owned by the shell package)

- **Phones:** one top app bar (56px; transparent over the texture band at rest, opaque once the page scrolls) with the brand logo or a back chevron, the title and one action. A bottom tab bar (56px + safe area) has labeled icons, and the active tab gets a `primary/10` pill with primary text.
  - **Tab icons:** Sell is a shopping bag. No icon draws a currency sign that isn't ₹.
  - **Manager tabs:** Sell · Orders · Stock · Catalog · More.
  - **Admin tabs:** Sell · Orders · Insights · Catalog · More.
  - **More:** opens a bottom sheet with 48px rows.
- **Bottom-anchored bars:** the POS cart bar and the save bar sit directly above the tab bar (`bottom-above-nav`). An open cart sheet covers the tab bar.
- **`md` and up:** admin keeps the sidebar. Its header holds the sidebar toggle and the route's breadcrumbs from md (no bare divider). The screen is named once: a last crumb equal to the page's h1 ("Orders") stays hidden while the h1 is on screen and fades in once it scrolls away; a leaf that differs ("Catalog › Desserts", "Insights › Day") always shows. Managers get the five destinations inline in the header.

## Spacing

- **Gutters:** 16px on phones and 24px from `md`.
- **Padding:** cards and lists use 16px horizontal padding and 12px vertical padding per row.
- **Section gaps:** 24px between sections and 16px from a section heading to its list.

## Enforced by `design-contract.test.ts`

The test scans `src/components` and `src/app`. Comments are ignored.

- **Allowed exceptions:** `ALLOWED` holds permanent, justified exceptions. `PENDING` lists files that other packages are still migrating, with the rule each one breaks and its owner. `PENDING` must only shrink.
- **Rules:**
  - `font-mono`
  - `Rs` currency
  - `toFixed(`
  - `toLocale*String(`
  - a raw `₹`
  - raw Tailwind hues
  - hex colour literals (`fill="#f2b38d"`, `bg-[#…]`)
  - `disabled:opacity-*`
  - emoji
  - known Title Case labels and "Nos"
  - `confirm(` / `alert(` / `prompt(` (use `ConfirmSheet`)
  - `md:hidden` / `hidden md:block` in a file that renders `<Table` or `<RecordList` (use `@3xl/main:` container variants)
- **Token checks:** status tokens exist, `chart-1` is primary, the contrast floors hold, and neutrals stay warm.
- **Debugging:** `DESIGN_CONTRACT_DUMP=1 pnpm exec vitest run src/lib/design-contract.test.ts` prints every violation, grouped by file.
