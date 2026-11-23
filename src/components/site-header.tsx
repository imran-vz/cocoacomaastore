"use client";

import { usePathname } from "next/navigation";

import { BreadcrumbNavigation } from "@/components/admin/breadcrumb-navigation";
import { useAppBarOverrides, usePageHeadingVisible, usePageScrolled } from "@/components/app-bar";
import { routeInfo } from "@/components/app-nav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Admin header from md up (below md the shared AppTopBar takes over).
 *
 * The sidebar toggle, then the route's breadcrumbs from the start at every width (md–lg
 * included), so the header always names where you are. The screen is named once: a last
 * crumb that equals the page's h1 ("Orders", "Settings") stays hidden while that heading is
 * on screen and fades in once it scrolls under the header. No bare divider.
 */
export function SiteHeader() {
	const pathname = usePathname();
	const overrides = useAppBarOverrides();
	const headingVisible = usePageHeadingVisible(pathname);
	const scrolled = usePageScrolled();
	const route = routeInfo(pathname);
	const title = overrides.title ?? route.title;

	return (
		<header
			className={cn(
				"sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-2 border-b px-3 transition-[background-color,border-color] duration-150 md:flex md:rounded-t-xl",
				scrolled ? "border-border bg-background" : "border-transparent bg-transparent",
			)}
		>
			<SidebarTrigger />
			<BreadcrumbNavigation className="min-w-0" pageTitle={title} pageTitleVisible={headingVisible === true} />
		</header>
	);
}
