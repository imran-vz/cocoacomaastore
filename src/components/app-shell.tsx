import { cn } from "@/lib/utils";

/**
 * Shell layout tokens, set on the outermost shell element of both roles:
 *
 * - `--app-bar-height`: sticky top bar height incl. the iOS status-bar inset. Use it for
 *   anything that sticks under the bar: `sticky top-(--app-bar-height)`.
 * - `--bottom-nav-height`: bottom tab bar height incl. the home-indicator inset below `md`,
 *   `0px` from `md` up. Anything fixed to the bottom (POS cart bar, SaveBar) uses
 *   `bottom-(--bottom-nav-height)` so it sits directly above the tabs.
 *
 * Both are inherited CSS variables: they reach every element rendered inside the shell,
 * not portaled popups. Outside a shell, read them with a fallback: `var(--bottom-nav-height, 0px)`.
 */
export const shellVarsClassName =
	"[--app-bar-height:calc(3.5rem+env(safe-area-inset-top))] [--bottom-nav-height:calc(3.5rem+env(safe-area-inset-bottom))] md:[--app-bar-height:3.5rem] md:[--bottom-nav-height:0px]";

/**
 * The scrolling page region, shared by both roles.
 *
 * - Pads for the bottom tab bar; `.min-h-app` pages fill exactly the space between the bars.
 * - Marks the region the app bar watches for the page title (`data-app-main`).
 * - Is the `@container/main` size container (DESIGN.md §Layout): every list↔table switch and
 *   multi-column layout inside a page queries the content width (`@3xl/main:…`), not the
 *   viewport, so the admin sidebar being open or collapsed never clips a table.
 */
export function AppMain({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<div
			data-app-main
			className={cn("@container/main relative flex min-w-0 flex-1 flex-col pb-(--bottom-nav-height)", className)}
		>
			{children}
		</div>
	);
}
