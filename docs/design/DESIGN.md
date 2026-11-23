# Cocoa Comaa design contract

Cocoa Comaa is a mobile-first PWA for the people behind the counter. A phone at 390px is the main screen. 360px must not break. Tablet (820px) and desktop (1440px) must stay good, and admin desktop keeps its sidebar.

This file is the contract. `src/test/design-contract.test.ts` checks the parts that can be checked statically. Change this file and the test together.

## Signature

- **Primary:** chocolate brown `oklch(0.33 0.06 31.42)`. Use it for primary actions, the selected state, the brand lockup and data series. Everything else is warm neutral.
- **Brand mark** (`src/components/ui/brand.tsx`):
  - `BrandLogo`, the photo logo (`/logo.png`, cropped to its ink ring in a circle), at every size: 32px in the app bar, sidebar header and collapsed rail, 48px in empty states, 72px in the sign-in hero.
  - The PWA icon files are the owner's assets and are unchanged.
- **Brand lockup:** the mark with the "Cocoa Comaa" wordmark in primary. Code names the shop with `BRAND_NAME` from the same file, never the literal.
- **Type:** Nunito Sans for everything, numbers included.
- **Texture:** one page layer, `.page-texture` (`globals.css`), on each shell root and the sign-in page. It draws the cocoa ring pattern (`/page-texture.svg`) at `--texture-opacity`.
  - **Clearly visible** in a top band behind the app bar and page header, fading out by `--texture-band` (240px), and in the outer gutters beside the content column on wide screens.
  - **Faint** (`--texture-floor` of full strength) behind content further down.
  - The app bar and admin header are transparent over the band at rest and turn opaque, with their hairline, once content scrolls beneath them.
  - Every card, list, sheet, chart and form surface on top of it is opaque. Don't add another background image for the texture anywhere else.

## Colour

All colour comes from tokens in `src/app/globals.css`. Raw Tailwind hues such as `text-green-600` or `bg-blue-100`, hex literals and `oklch()`/`rgb()` colour values are not allowed in components; they belong in `globals.css`.

| Token | Use |
| --- | --- |
| `background` | Page background (warm off-white, under the texture) |
| `card`, `popover` | Every surface on top of the page |
| `foreground` | Body text and titles |
| `muted`, `muted-foreground` | Quiet surfaces (tracks, tiles, disabled fills) and secondary text. Meets 4.5:1 on background, card and muted |
| `border`, `input` | Hairlines and field borders |
| `accent` | Hover and pressed surfaces |
| `primary`, `primary-foreground` | Primary action, selection, brand |
| `success`, `warning`, `destructive` | Status only |

- **Neutrals** sit at hue 40–75 with chroma ≤ 0.03, the same temperature as the brown. The test checks this.
- **Status colours** are for status only: badges, deltas against a real comparison, and validation. They are never used for section headings, decorative icons, "∞" glyphs or "Best day" labels.
- **Charts:** a single series uses one hue (`primary` for the selected bar, `primary` at 25% for the rest). A comparison uses `primary` against `muted-foreground/40`. Ranked lists use one hue, not a colour per category.
- **Contrast floors** are enforced by the test: foreground ≥ 7:1, muted text ≥ 4.5:1, and status and primary text ≥ 4.5:1 on card.

There is no dark theme: nothing in the app switches to one, so there are no dark tokens or `dark:` classes.

## Type

| Role | Size / weight | Notes |
| --- | --- | --- |
| Page title | 22/700 on phones, 26/700 from `md` | Comes from `PageHeader`; equals the nav label |
| Section heading | `text-row` (15/20, 600), foreground, sentence case | Comes from `SectionHeading`. A count follows in muted text, e.g. "Available 11" |
| Row title | `text-row` | Comes from `ListRow`; every other 15/600 line (an empty state's title, the save bar's summary) uses it too |
| Body | 15–16 | Inputs use 16px on phones so iOS doesn't zoom |
| Meta | `text-meta` (13/18), muted | Join parts with " · " |
| Sheet title | `text-sheet-title` (17, 600) | Comes from `OverlayTitle` |
| KPI value | 24–28/700, tabular | The label under it is 13 muted, sentence case |

- **Sentence case everywhere:** titles, labels, buttons, menu items and tabs. Write "Add dessert", "Save stock", "Avg order value". Acronyms such as UPI, QR and PDF stay upper case, and the Sell screen keeps its capital.
- **No emoji** in copy or headings.
- **No coloured headings.** A heading is never green, red or teal, and never brand-coloured.
- The type roles are `@theme` tokens in `globals.css`; the test rejects their pixel sizes written out (`text-[13px]`, `text-[15px] leading-5 font-semibold`).

## Numbers and formatting

`src/lib/format.ts` is the only place that formats something for display. Components never call `toFixed`, `toLocaleString`, `toLocaleDateString` or `toLocaleTimeString`, and never build `₹` or `Rs` strings themselves.

| Helper | Output |
| --- | --- |
| `formatINR(v)` | `₹7,750`, `₹92.50`, `₹12,00,882`. Uses `en-IN` lakh grouping. With the default `paise: "auto"`, whole rupees show no decimals |
| `formatINR(v, { paise: "always" \| "never" })` | `₹80.00` / `₹93` |
| `formatINRCompact(v)` | Chart axes and tight tiles: `₹950`, `₹7.8K`, `₹12L` |
| `formatNumber(n)` | `1,23,456` |
| `formatPercent(ratio)` | `42%` |
| `formatSigned(change, format?)` | `+12`, `−3` (a true minus), `+12%` with `formatPercent`; a change that shows as zero has no sign |
| `formatOrderNumber(id)` | `#1042` |
| `formatCount(n, unit)` | `75 sold` (a word that never changes), `1 item` / `5 items` with a noun from `UNIT` (`UNIT.item`, `UNIT.order`…). Never "Nos" |
| `formatTime(d)` | `12:30 AM` |
| `formatDate(d)` | `23 Nov 2026` |
| `formatDateShort(d)` | `23 Nov` |
| `formatDayShort(d)` | `Mon, 23 Nov` |
| `formatFullDate(day)` | `Monday, 23 November 2026` |
| `formatRelativeDay(day, today)` | `Today · 23 Nov`, `Yesterday · 22 Nov`, otherwise `Sat, 21 Nov` |
| `formatMonth("2026-09")` | `September 2026`. Month selects show this, never `2026-09` |
| `formatMonthShort("2026-09")` | `Sep`, never "Sept" |
| `formatInitials(name)` | `CA`, `CM`, taken from the name's words |

- **Time zone:** every date and time shows in shop time (`Asia/Kolkata`). A `YYYY-MM-DD` key is treated as a calendar day, with no time-zone shift.
- **Figures:** numbers use the UI sans with tabular figures (`tabular-nums`).
- **`font-mono`** is only for UPI IDs and copied receipt text. Order numbers, times and totals are never monospace.

## Touch

- **Hit area:** below `md`, every interactive control has a hit area of at least 44×44. This covers buttons, icon buttons, steppers, switches, checkboxes, date arrows, the sidebar trigger, the password eye and menu triggers. Compact sizes are allowed from `md` up. A control drawn smaller than 44px gets an invisible box from the `touch-target` utility.
- **`Button`:**
  - `default` is 44px tall on phones and 36px from `md`.
  - `lg` is 48 on phones and 40 from `md`.
  - `icon` is 44 on phones and 36 from `md`.
  - `icon-touch` is 44 at every width. Use it for app-bar actions, steppers and row actions.
  - `sm` keeps its small look and gets the 44px `touch-target` below `md`.
- **Inputs:** `Input` and `SelectTrigger` are 44px with 16px text on phones and 36px / 14px from `md`. Values are `text-foreground`. Placeholders are only for empty fields and never carry rules. Put rules in helper text below the field.
- **Menus and toggles:** `DropdownMenuItem` and `SelectItem` rows are 44px on phones. `Switch` is 24×40 on phones and 18×32 from `md`. `Checkbox` is 20px on phones. Both reach 44px through their hit area.
- **Close buttons:** an overlay's ✕ is 44px at every width.

## Focus

There is one keyboard focus ring: a 2px solid `--focus-ring` (primary at 60%) with a 2px offset, from the `focus-ring` utility. Links, buttons and anything with `tabindex` get it from the base layer. Rows and controls inside a clipping container (list rows, sidebar items, the cart's scroll area) use `focus-ring-inset`, the same ring drawn inside the edge. When the ring belongs on a part of a focused control (the bottom tab's icon pill), the control gets `group` and the part gets `focus-ring-group`. Don't add `ring-*` or hand-written `outline-*` focus styles.

A control that sits inside a field (the password eye) draws the ring further inside (`focus-visible:outline-offset-[-5px]` on a rounded button), so it never overlaps the field's corner.

Primary at 40% would measure about 2:1 on the cream page, too faint to see; 60% keeps the ring visible.

## Disabled

A disabled control is quiet; it does not turn into a new colour, and it does not fade with opacity.

- **Filled buttons** (default, secondary, destructive-solid) become `bg-muted text-muted-foreground`.
- **Outline buttons** keep their surface and mute their text.
- **Inputs** become `bg-muted text-muted-foreground`.
- **Switches** use a muted track.
- **Exceptions:** a `Button` that is `busy` or showing `feedback` (success or error) keeps its colour, so the feedback stays readable.

Fading a disabled control with opacity (`disabled:opacity-*`, `peer-disabled:opacity-*` and the like) is not allowed.

## Badges

A badge is a status exception the reader must notice.

- **Routine states get no badge.** A completed order, an enabled UPI account and a role all render as plain muted text.
- **Two badges:** `destructive` (Cancelled, Disabled, Out of stock, Sold out) and `warning` (Low).

## Layout

- **Frames** come from the route map (`frame` in `src/features/shell/routes.ts`); the shell applies them, so pages never wrap themselves:
  - `narrow` (max-w-3xl): lists and forms — Catalog, Stock, Settings, Managers, UPI accounts.
  - `wide` (max-w-7xl): data — Orders, Insights.
  - `bleed`: a screen that draws its own gutters (Sell); its column is the wide column plus gutters, so its edges line up with the others.
  - **Left-aligned** to the page title's edge. A frame is never centred inside the admin inset, and a page never adds its own `mx-auto max-w-*` column. In the manager area the column is centred under the top bar and narrow content stays left-aligned inside it.
- **Content width, not viewport.** The shell's page region (`ShellMain`, the `<main>` landmark) is the `@container/main` size container. Every list↔table switch and every multi-column layout inside a page queries it: `@3xl/main:hidden` / `hidden @3xl/main:block`, `@2xl/main:grid-cols-2`. Viewport breakpoints (`md:`) are for the shell itself (bars, sidebar, gutters, type scale), not for what's inside a page. Admin at 820px with the sidebar open has ~540px of content, so it gets the list.
- **Height:** the shell's frame uses `min-h-app` = `100dvh − --app-bar-height − --bottom-nav-height` (minus the admin inset's own margin from md). A short page never scrolls, not even by 1px. Don't use `100vh` or `min-h-screen` inside the shell.

## Page header

Every page starts with `PageHeader` (`src/components/ui/page-header.tsx`).

- **Title:** equals the nav label, in sentence case: pages take it from the route map (`usePageTitle()`, over `src/features/shell/routes.ts`), never a literal. Its `<h1 data-app-title>` lets the mobile app bar show the title only after the heading scrolls away. The route map also holds each screen's document description (`pageMetadata`).
- **Description:** one muted line (optional).
- **Primary action:** one, on the right, built with `PageHeaderAction`. It is a 44px icon button on phones and has an icon and a label from `md`.
- **`secondary`:** quiet extras such as a `⋯` overflow menu. Destructive bulk actions like "Hide all desserts" live there, behind a `ConfirmSheet`.
- **`children`:** one row under the title, such as a segmented control, a date switcher (`DateSwitcher`) or a search field (`SearchField`, which the Sell screen uses too).

## Records

A table renders only when the **content** is wide enough: below `@3xl/main` (768px of content), records use `RecordList` + `ListRow` (`src/components/ui/list-row.tsx`); from `@3xl/main`, `Table` may take over. Never switch records on `md:` — with the admin sidebar open, a viewport breakpoint shows a table in a column too narrow for it (§Layout).

- **`RecordList`:** one `surface-card` with divided rows. `RecordListSkeleton` is its loading form.
- **`ListRow`:**
  - an optional 40px `ListRowTile` (initials or an icon)
  - a title (15/600, up to two lines)
  - meta (13 muted, wraps)
  - a right-aligned `trailing` value (tabular) with optional `trailingMeta` (a status word or badge)
  - an optional `action` outside the tap area (a 44px icon button, a `Switch` or a `⋯` menu)
  - a chevron when the row has `href` or `onClick`
  - a minimum height of 56px
- **`ListSection`:** a `SectionHeading` with a count, then the list. `SectionHeadingSkeleton` is the heading's loading form.
- **Hidden or disabled records** use normal text plus a muted "Hidden" label. Don't stack strikethrough on top of opacity.
- **"Unlimited"** stock is written as the word in muted text, not a coloured ∞.

## Segmented control

`src/components/ui/segmented-control.tsx` has one look for two jobs: a warm-grey track with the selected segment raised on `card` in primary text, 44px tall on phones and, at `size="sm"`, 36px from `md`. It fills its container's width with equal segments. The catalog's reorder bar, which stands in for the filter row, takes the track's outline (`segmentedTrackShapeClassName`).

- **`SegmentedControl`** chooses a value. Use it for the Available | Hidden filter, the cart's Order type (In store | Online order) and its UPI account. It is a radio group with arrow-key navigation, and segments can show a muted count.
- **`SegmentedLinks`** switches between sibling pages, such as Desserts | Combos on Catalog and Day | Month on Insights. It uses links with `aria-current="page"`. The date itself lives in one date stepper ("Today · 23 Nov"), never in the section control as well.

Use a segmented control instead of stacked tables, native `<select>`s or a select over a select.

## Save bar

`SaveBar` (`src/components/ui/save-bar.tsx`) appears only while a form has unsaved changes. It shows "3 changes", a ghost "Discard" and the primary save action ("Save stock").

- **Phones:** it is fixed directly above the bottom tab bar (`bottom-above-nav`, read from `--bottom-nav-height`) and is safe-area aware (`pb-safe-above-nav`). It adds a spacer, so the last rows of the page stay reachable.
- **`md` and up:** it is a sticky floating card at the bottom of the content column.
- **Save action:** the form's own save control, usually a `useReactiveButton` button, goes in as `children`. The caller writes the summary ("3 changes", "Stock saved").

## Overlays

Every overlay is a real modal: the cart sheet, the More sheet, form sheets, `ConfirmSheet` and the date picker.

- **Focus is trapped** while open and the page behind is inert (Tab and Shift+Tab never reach it; it can't be clicked).
- **Initial focus:** Close (cart), the first field (forms; a touch open focuses the sheet instead so the keyboard doesn't pop), the safe action (confirmations).
- **Return:** focus goes back to the trigger on Escape, close and swipe. If the trigger is gone (the last cart line was removed), it goes to the nearest stable control (the search field).
- **How:** every overlay is built from `src/components/ui/overlay.tsx`: `OverlayRoot`, then `OverlayContent` (scrim, focus trap, popup, grabber), then `OverlayHeader` or `OverlayTitle`. Base UI hides the page from assistive tech and handles Escape and focus return, but lets Tab walk out of the popup, so `OverlayContent` always adds a focus trap. Pass `initialFocus` / `finalFocus` when the default target is wrong. The POS cart sheet is hand-built for its drag gesture: it uses `useModalFocus` (`src/components/ui/use-modal-focus.ts`) and the same scrim, sheet surface and grabber.
- **Shape:** `responsive` (forms, confirmations) is a bottom sheet below md and a centred dialog from md; `sheet` (the More sheet, the phone date picker) is a bottom sheet at every width. Bottom sheets have a rounded top, a grabber and safe-area padding (`pb-safe-*`).
- **Header:** with actions (a form's ⋯ and Save) it reads `✕ · Title · actions`; without, `Title · ✕`.
- **Layers:** bars sit on `z-bar`; every overlay, scrim and popup on `z-overlay`, and a popup opened inside an overlay renders after it, so it shows above.

## Feedback

An action that takes a moment shows its progress on the control that started it (`src/components/ui/feedback.ts`): idle → loading → success or error → idle.

- **Buttons:** `useReactiveButton` swaps the label and icon in place (a spinner, a check, an alert) and tints the button for the flash. Success on the primary button is a primary tint; on any other button it is the success tint. Errors use the destructive tint.
- **Rows:** a list switch flashes a check or a cross over itself (`FeedbackCheck`), one feedback state per row.
- **Lengths:** `FEEDBACK_MS` names every flash: `reject` (700ms, a Sell tile shaking off an add the cart refused), `beforeClose` (900ms, a save whose sheet then closes), `inline` (1200ms, rows, tiles, the cart), `success` (1500ms), `copied` (2000ms) and `error` (2500ms). The test rejects other numbers.
- **Screen readers:** string success and error labels are announced through one live region for the whole app.
- **One spinner:** `Spinner`.

## Confirmations

`ConfirmSheet` (`src/components/ui/confirm-sheet.tsx`) is the only destructive confirmation. `window.confirm`, `alert` and `prompt`, popovers and ad-hoc dialogs are not allowed.

- **Shape:** a bottom sheet over a scrim below md, an alert dialog from md.
- **Copy:** the title is a question naming the thing ("Delete Council Manager?", "Cancel order #5008?"), then one muted line on the consequence. Use the optional slot for an input the action needs (the cancel reason, with the shared `Select` or `SegmentedControl`).
- **Buttons:** a full-width solid destructive confirm (48px on phones) with a verb + noun label ("Delete manager", "Cancel order"), then a ghost safe action ("Cancel", or "Keep order" where "Cancel" would be ambiguous). Focus starts on the safe action. While the action runs, the confirm button shows its busy label and the sheet can't be dismissed. An error stays in the sheet.
- **Scope:** only actions that destroy or hide stored data: delete manager, delete UPI account, cancel order, hide all desserts, delete dessert, delete combo, and discarding a dirty form. Nothing else gains a confirmation.

## Forms

Add and edit forms (dessert, combo, manager, UPI account) use `FormSheet` (`src/components/ui/form-sheet.tsx`).

- **Shape:** a full-height bottom sheet below md, a centred dialog from md, with the same header at every width: `✕ · Title · [⋯] [primary]`. The primary stays in the header so it is always in one place and above the phone keyboard. The form body scrolls.
- **Dirty-aware:** the primary ("Save", "Add") is disabled until a field differs from its initial value. `FormSheet` renders the `<form>` and runs the save itself (`onSave`, a success flash and closing; a failed result flashes its error on the primary), so while it saves, the sheet can't close. Closing a dirty form with ✕, Escape or the scrim asks "Discard changes?" (Discard / Keep editing). Closing after a successful save never asks.
- **Fields:** the sheet's children are a fields component that holds the form's values and reports them with `useFormSheet({ dirty, onSave })`. `FormSheet` mounts it afresh on every opening, so each opening starts from the saved record; callers only keep `{ open, record }` and leave the record set while the sheet closes.
- **Destructive actions** (Delete dessert, Delete combo) sit behind the `⋯` in the header and open a `ConfirmSheet`. They never sit next to Save. Pass `onDelete` with `deleteLabel`, `deleteTitle` and `deleteDescription`; the sheet owns the menu, the confirmation and closing once deleted.
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
- **`md` and up:** admin keeps the sidebar. Its header holds the sidebar toggle and the route's breadcrumbs from md (no bare divider). The screen is named once: a last crumb equal to the page's h1 ("Orders") stays hidden while the h1 is on screen and fades in once it scrolls away; a leaf that differs ("Catalog › Desserts", "Insights › Day") always shows. Managers get their four tabs inline in the header (Sell, Orders, Stock, Catalog); Combos is reached from Catalog and Settings from the account menu.

## Spacing

- **Gutters:** 16px on phones and 24px from `md`.
- **Cards:** every card, list and panel surface is `surface-card` (radius xl, hairline border, `card` fill).
- **Padding:** cards and lists use 16px horizontal padding and 12px vertical padding per row.
- **Section gaps:** 24px between sections and 16px from a section heading to its list.

## Enforced by `design-contract.test.ts`

The test scans `src/components`, `src/app` and `src/features`, ignoring comments. Each rule's description in the test says what to do instead. `ALLOWED` holds justified exceptions, each with its reason; an entry that no longer matches anything fails the test. Besides the rules, it checks the contrast floors, that neutrals stay warm, that the browser chrome colour (`src/app/theme-color.ts`) matches `--background`, and that Motion tweens (`src/lib/motion.ts`) keep time with the CSS duration tokens.
