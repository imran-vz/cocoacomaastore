"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { routeInfo } from "@/features/shell/routes";

/** The title of the screen being shown, for its page header (from the route map). */
export function usePageTitle(): string {
	return routeInfo(usePathname()).title;
}

/** The bottom edge of whichever shell bar is showing (the top bar below md, the admin header from md). */
function barBottom(): number {
	const bars = document.querySelectorAll<HTMLElement>("[data-shell-bar]");
	for (const bar of bars) {
		if (bar.offsetHeight > 0) return Math.round(bar.getBoundingClientRect().bottom);
	}
	return 0;
}

/**
 * Whether the page's own title (an `h1` or `[data-app-title]` inside the shell's main region)
 * is on screen below the bar, or `null` when the page has none. The bar names the page only
 * once that heading scrolls under it, so a title never shows twice.
 */
export function usePageHeadingVisible(pathname: string): boolean | null {
	const [visible, setVisible] = useState<boolean | null>(true);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-scan the page whenever the route changes
	useEffect(() => {
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
			intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
				rootMargin: `-${barBottom()}px 0px 0px 0px`,
			});
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

const SCROLLED_AFTER_PX = 2;

/**
 * True once the document has scrolled. The bars are transparent over the page texture's
 * top band at rest and turn opaque as soon as content can pass beneath them.
 */
export function usePageScrolled(): boolean {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		let frame = 0;
		const update = () => {
			frame = 0;
			setScrolled(window.scrollY > SCROLLED_AFTER_PX);
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
	}, []);

	return scrolled;
}
