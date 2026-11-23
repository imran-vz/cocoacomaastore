"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { BRAND_NAME, BrandLogo, BrandWordmark } from "@/components/ui/brand";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { homeOf, type StaffUser } from "@/features/access/area";
import { AccountMenu, UserAvatar } from "@/features/shell/account-menu";
import { type Crumb, isLinkActive, type RouteInfo, routeInfo, tabsFor } from "@/features/shell/routes";
import { usePageHeadingVisible, usePageScrolled } from "@/features/shell/use-page-chrome";
import { cn } from "@/lib/utils";

/**
 * The sticky bar(s) above the page, `--bar-height` tall plus the iOS status-bar inset.
 *
 * Below md, both areas: the logo (or a back link on sub-pages) and a text slot that shows the
 * wordmark while the page's own title is on screen and the page title once it scrolls away.
 * From md, the `tabs` layout keeps the same bar with the primary destinations and the account
 * menu; the `sidebar` layout gets a header with the sidebar toggle and breadcrumbs.
 */
export function TopBar({ user, layout }: { user: StaffUser; layout: "sidebar" | "tabs" }) {
	const pathname = usePathname();
	const route = routeInfo(pathname);
	const headingVisible = usePageHeadingVisible(pathname);
	const scrolled = usePageScrolled();
	const showTitle = !route.home && headingVisible !== true;

	// Transparent over the page texture's top band at rest; opaque with a hairline once content
	// scrolls beneath. The hairline is an inset shadow so the bar keeps its exact height.
	const surface = scrolled ? "bg-background shadow-[inset_0_-1px_0_var(--color-border)]" : "bg-transparent";

	return (
		<>
			<header
				data-shell-bar
				className={cn(
					"sticky top-0 z-bar pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-fast",
					surface,
					layout === "sidebar" && "md:hidden",
				)}
			>
				<div className="mx-auto flex h-(--bar-height) max-w-(--shell-column) items-center gap-1 px-2 md:gap-6 md:px-6">
					<MobileTitle area={user.area} route={route} showTitle={showTitle} withWordmark={layout === "tabs"} />
					{layout === "tabs" ? (
						<>
							<DesktopTabs user={user} pathname={pathname} />
							<DropdownMenu>
								<DropdownMenuTrigger
									aria-label="Account menu"
									className="hidden size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted md:inline-flex"
								>
									<UserAvatar user={user} />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-64">
									<AccountMenu user={user} variant="dropdown" />
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					) : null}
				</div>
			</header>
			{layout === "sidebar" ? (
				<header
					data-shell-bar
					className={cn(
						"sticky top-0 z-bar hidden h-(--bar-height) shrink-0 items-center gap-2 border-b px-3 transition-[background-color,border-color] duration-fast md:flex md:rounded-t-xl",
						scrolled ? "border-border bg-background" : "border-transparent bg-transparent",
					)}
				>
					<SidebarTrigger />
					<Breadcrumbs
						crumbs={route.crumbs}
						hideLast={headingVisible === true && route.crumbs.at(-1)?.label === route.title}
					/>
				</header>
			) : null}
		</>
	);
}

function MobileTitle({
	area,
	route,
	showTitle,
	withWordmark,
}: {
	area: StaffUser["area"];
	route: RouteInfo;
	showTitle: boolean;
	withWordmark: boolean;
}) {
	const { back, title } = route;
	return (
		<>
			{back ? (
				<Link
					href={back.href}
					aria-label={`Back to ${back.label}`}
					className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-[15px] font-medium text-primary hover:bg-muted md:hidden"
				>
					<ChevronLeft className="size-6" strokeWidth={2} />
					<span className={cn("transition-opacity duration-fast", showTitle && "sr-only")}>{back.label}</span>
				</Link>
			) : null}

			<Link
				href={homeOf(area)}
				aria-label={`${BRAND_NAME} home`}
				className={cn(
					"inline-flex size-11 shrink-0 items-center justify-center rounded-full md:size-auto md:gap-2.5",
					back && "max-md:hidden",
				)}
			>
				<BrandLogo size={32} />
				{withWordmark ? <BrandWordmark className="hidden text-[17px] md:inline" /> : null}
			</Link>

			<div className="relative grid min-w-0 flex-1 items-center md:hidden">
				{back ? null : (
					<BrandWordmark
						className={cn(
							"col-start-1 row-start-1 truncate text-[17px] transition-opacity duration-fast",
							showTitle ? "pointer-events-none opacity-0" : "opacity-100",
						)}
					/>
				)}
				<span
					aria-hidden={!showTitle}
					className={cn(
						"col-start-1 row-start-1 truncate text-[17px] font-semibold tracking-tight text-foreground transition-opacity duration-fast",
						showTitle ? "opacity-100" : "pointer-events-none opacity-0",
					)}
				>
					{title}
				</span>
			</div>
		</>
	);
}

function DesktopTabs({ user, pathname }: { user: StaffUser; pathname: string }) {
	return (
		<nav aria-label="Primary" className="hidden min-w-0 flex-1 md:block">
			<ul className="flex items-center gap-1">
				{tabsFor(user.area).map((tab) => {
					const active = isLinkActive(tab, pathname);
					return (
						<li key={tab.href}>
							<Link
								href={tab.href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors",
									active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								<tab.icon className="size-[18px]" strokeWidth={active ? 2.1 : 1.75} />
								{tab.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/**
 * The route's trail. When the last crumb repeats the page's own `h1`, it stays hidden while
 * that heading is on screen and fades in once it scrolls away.
 */
function Breadcrumbs({ crumbs, hideLast }: { crumbs: Crumb[]; hideLast: boolean }) {
	if (crumbs.length === 0) return null;

	return (
		<Breadcrumb className="min-w-0">
			<BreadcrumbList className="flex-nowrap">
				{crumbs.map((crumb, index) => {
					const isLast = index === crumbs.length - 1;
					const hidden = isLast && hideLast;
					return (
						<Fragment key={`${crumb.label}-${index}`}>
							<BreadcrumbItem
								aria-hidden={hidden || undefined}
								className={cn("min-w-0 transition-opacity duration-fast", hidden && "pointer-events-none opacity-0")}
							>
								{isLast || !crumb.href ? (
									<BreadcrumbPage className="truncate font-semibold">{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link href={crumb.href}>{crumb.label}</Link>} />
								)}
							</BreadcrumbItem>
							{isLast ? null : (
								<BreadcrumbSeparator
									className={cn(
										"transition-opacity duration-fast",
										index === crumbs.length - 2 && hideLast && "opacity-0",
									)}
								/>
							)}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
