// Geometry shared by the Sell screen and its loading skeleton. Plain strings in a plain module so the
// server-rendered skeleton can import them, and literal class names so Tailwind finds them.

/** The Sell screen's root: a `pos` container with 16px gutters on phones and 24px from md. */
export const POS_ROOT_CLASS = "@container/pos min-h-app flex flex-col md:flex-row md:gap-4 md:px-6";

export const POS_SEARCH_ROW_CLASS = "px-4 pt-3 pb-2 md:px-0 md:pt-6 md:pb-3";

export const POS_GRID_ROW_CLASS = "flex-1 px-4 pt-1 md:px-0";

/**
 * Tiles are at least 150px wide: two columns on every phone from 360px up, one below that, and more
 * as the `products` container (not the viewport) grows. From a 768px pane the minimum rises so wide
 * desktops don't turn into a wall of tiles.
 */
export const TILE_GRID_CLASS =
	"grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 @md/products:gap-3 @3xl/products:grid-cols-[repeat(auto-fill,minmax(176px,1fr))]";

/**
 * The inline cart sits beside the grid only when the POS pane (not the viewport) has room for a 340px
 * catalog, the 16px gap and the 300px cart: at 820px with the admin sidebar open the pane is ~520px and a
 * side cart would crush the grid. Phones (< md) never get it; their tab bar owns the bottom.
 */
export const INLINE_CART_MIN_PANE = 340 + 16 + 300;

/**
 * {@link INLINE_CART_MIN_PANE} as a container query on the POS root. A container query measures the
 * content box, so the root's own gutters are already left out, as they are in `PosHome`'s measurement.
 */
export const SHOWN_WITH_INLINE_CART = "hidden md:@min-[656px]/pos:block";

export const INLINE_CART_COLUMN_CLASS =
	"sticky top-[calc(var(--app-bar-height)+1.5rem)] mb-6 h-[calc(100svh-var(--app-bar-height)-3rem)] w-75 shrink-0 self-start @4xl/pos:w-85 @6xl/pos:w-95";

/** `touch`: 44px controls throughout (the cart sheet). `compact`: smaller controls from md up (the inline cart). */
export type CartDensity = "touch" | "compact";
