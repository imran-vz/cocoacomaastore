"use client";

import * as React from "react";

/**
 * Page-level API for the shell's top app bar (mobile) and header (desktop).
 *
 * Defaults come from the route table in `app-nav.ts`, so most pages need nothing.
 * A page overrides them while it is mounted:
 *
 * ```tsx
 * // Server or client component
 * <AppBar title="Managers" back="/admin/settings" action={<AddManagerButton />} />
 *
 * // Client component
 * useAppBar({ action: <Button size="icon-touch" aria-label="Add dessert">…</Button> });
 * ```
 *
 * - `title`: replaces the route title shown once the page heading scrolls away.
 * - `back`: `{ href, label }` shows a back chevron instead of the logo; `null` forces the logo.
 * - `action`: one right-aligned control, shown in the mobile app bar only (< md).
 *   Use it for a page's single primary action (44px `icon-touch` button with an aria-label)
 *   and hide the same action in the page header below md, so it renders once.
 */
export type AppBarBack = { href: string; label: string };

export type AppBarOptions = {
	title?: string;
	back?: AppBarBack | null;
	action?: React.ReactNode;
};

type AppBarSetter = (id: number, options: AppBarOptions | null) => void;

const AppBarStateContext = React.createContext<AppBarOptions>({});
const AppBarSetterContext = React.createContext<AppBarSetter | null>(null);

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function AppBarProvider({ children }: { children: React.ReactNode }) {
	const [entries, setEntries] = React.useState<Map<number, AppBarOptions>>(() => new Map());

	const set = React.useCallback<AppBarSetter>((id, options) => {
		setEntries((previous) => {
			const next = new Map(previous);
			if (options) next.set(id, options);
			else next.delete(id);
			return next;
		});
	}, []);

	// The most recently mounted registration wins, field by field.
	const state = React.useMemo<AppBarOptions>(() => {
		const merged: AppBarOptions = {};
		for (const options of entries.values()) {
			if (options.title !== undefined) merged.title = options.title;
			if (options.back !== undefined) merged.back = options.back;
			if (options.action !== undefined) merged.action = options.action;
		}
		return merged;
	}, [entries]);

	return (
		<AppBarSetterContext.Provider value={set}>
			<AppBarStateContext.Provider value={state}>{children}</AppBarStateContext.Provider>
		</AppBarSetterContext.Provider>
	);
}

let nextId = 0;

/** Register app bar overrides for as long as the calling component is mounted. */
export function useAppBar(options: AppBarOptions) {
	const set = React.useContext(AppBarSetterContext);
	const [id] = React.useState(() => ++nextId);
	const { title, back, action } = options;
	const backHref = back?.href;
	const backLabel = back?.label;
	const hasBack = back === undefined ? undefined : back !== null;

	useIsomorphicLayoutEffect(() => {
		if (!set) return;
		set(id, {
			title,
			back:
				hasBack === undefined ? undefined : hasBack && backHref ? { href: backHref, label: backLabel ?? "Back" } : null,
			action,
		});
	}, [set, id, title, hasBack, backHref, backLabel, action]);

	useIsomorphicLayoutEffect(() => {
		if (!set) return;
		return () => set(id, null);
	}, [set, id]);
}

/** Server-component-friendly form of `useAppBar`. Renders nothing. */
export function AppBar(props: AppBarOptions) {
	useAppBar(props);
	return null;
}

export function useAppBarOverrides(): AppBarOptions {
	return React.useContext(AppBarStateContext);
}

/**
 * Tracks whether the page's own title (`h1` inside the shell's main region, or any element
 * with `data-app-title`) is on screen below the app bar. Returns `null` when the page has none.
 * The app bar shows the page title only after that heading scrolls away (iOS large-title pattern),
 * so a title never appears twice on screen.
 */
export function usePageHeadingVisible(pathname: string): boolean | null {
	const [visible, setVisible] = React.useState<boolean | null>(true);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scan the page whenever the route changes
	React.useEffect(() => {
		const main = document.querySelector("[data-app-main]");
		if (!main) {
			setVisible(null);
			return;
		}

		let observed: Element | null | undefined;
		let intersection: IntersectionObserver | null = null;

		const findHeading = () =>
			Array.from(main.querySelectorAll("[data-app-title], h1")).find(
				(element) => element instanceof HTMLElement && element.offsetHeight > 4,
			) ?? null;

		const attach = () => {
			const heading = findHeading();
			if (heading === observed) return;
			intersection?.disconnect();
			observed = heading;
			if (!heading) {
				setVisible(null);
				return;
			}
			const barHeight = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 3.5;
			intersection = new IntersectionObserver(
				([entry]) => {
					setVisible(entry.isIntersecting);
				},
				{ rootMargin: `-${Math.round(barHeight)}px 0px 0px 0px` },
			);
			intersection.observe(heading);
		};

		attach();
		let frame = 0;
		const mutation = new MutationObserver(() => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				attach();
			});
		});
		mutation.observe(main, { childList: true, subtree: true });

		return () => {
			cancelAnimationFrame(frame);
			mutation.disconnect();
			intersection?.disconnect();
		};
	}, [pathname]);

	return visible;
}

/**
 * True once the document has scrolled. The shell bars are transparent over the page
 * texture's top band at rest and turn opaque (with their hairline) as soon as content
 * can pass beneath them.
 */
export function usePageScrolled(threshold = 2): boolean {
	const [scrolled, setScrolled] = React.useState(false);

	React.useEffect(() => {
		let frame = 0;
		const update = () => {
			frame = 0;
			setScrolled(window.scrollY > threshold);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
		};
	}, [threshold]);

	return scrolled;
}
