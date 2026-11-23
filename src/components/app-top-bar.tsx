"use client";

import { IconChevronLeft } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAppBarOverrides, usePageHeadingVisible, usePageScrolled } from "@/components/app-bar";
import { type AppRole, homeFor, isLinkActive, moreLinksFor, routeInfo, tabsFor } from "@/components/app-nav";
import { BrandLogo, BrandWordmark } from "@/components/brand-lockup";
import { reactiveMenuItemClassName, useCacheRefreshController } from "@/components/cache-refresh-menu-item";
import { type ShellUser, UserSummary, useLogoutButton } from "@/components/more-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Sticky 56px top bar.
 * - < md, both roles: logo mark (or a back chevron on sub-pages) + text slot + one optional action.
 *   The text slot shows the "Cocoa Comaa" wordmark while the page's own title is on screen and
 *   swaps to the page title once that heading scrolls under the bar, so a title never shows twice.
 * - ≥ md, manager only (`desktopNav`): brand lockup, the primary destinations as inline tabs, and
 *   the account menu (More destinations, Refresh data, Log out). Admin uses the sidebar there.
 */
export function AppTopBar({
	area,
	user,
	desktopNav = false,
}: {
	area: AppRole;
	user: ShellUser;
	desktopNav?: boolean;
}) {
	const pathname = usePathname();
	const overrides = useAppBarOverrides();
	const route = routeInfo(pathname);
	const headingVisible = usePageHeadingVisible(pathname);
	const scrolled = usePageScrolled();

	const title = overrides.title ?? route.title;
	const back = overrides.back === undefined ? route.back : (overrides.back ?? undefined);
	const showTitle = route.home ? false : headingVisible !== true;

	return (
		<header
			data-slot="app-top-bar"
			className={cn(
				"sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-150",
				// Transparent over the page texture's top band at rest; opaque with an inset hairline
				// once content scrolls beneath. The hairline is a shadow so the bar is exactly
				// --app-bar-height tall.
				scrolled ? "bg-background shadow-[inset_0_-1px_0_var(--color-border)]" : "bg-transparent",
				!desktopNav && "md:hidden",
			)}
		>
			<div className="mx-auto flex h-14 max-w-[83rem] items-center gap-1 px-2 md:gap-6 md:px-6">
				{back ? (
					<Link
						href={back.href}
						aria-label={`Back to ${back.label}`}
						className="inline-flex h-11 shrink-0 items-center gap-0.5 rounded-full pr-3 pl-1.5 text-[15px] font-medium text-primary hover:bg-muted md:hidden"
					>
						<IconChevronLeft className="size-6" stroke={2} />
						<span className={cn("transition-opacity duration-150", showTitle && "sr-only")}>{back.label}</span>
					</Link>
				) : null}

				<Link
					href={homeFor(area)}
					aria-label="Cocoa Comaa home"
					className={cn(
						"inline-flex size-11 shrink-0 items-center justify-center rounded-full md:size-auto md:gap-2.5",
						back && "max-md:hidden",
					)}
				>
					<BrandLogo size={32} />
					{desktopNav ? <BrandWordmark className="hidden text-[17px] md:inline" /> : null}
				</Link>

				{/* Mobile text slot: wordmark ↔ page title */}
				<div className="relative grid min-w-0 flex-1 items-center md:hidden">
					{back ? null : (
						<BrandWordmark
							className={cn(
								"col-start-1 row-start-1 truncate text-[17px] transition-opacity duration-150",
								showTitle ? "pointer-events-none opacity-0" : "opacity-100",
							)}
						/>
					)}
					<span
						aria-hidden={!showTitle}
						className={cn(
							"col-start-1 row-start-1 truncate text-[17px] font-semibold tracking-tight text-foreground transition-opacity duration-150",
							showTitle ? "opacity-100" : "pointer-events-none opacity-0",
						)}
					>
						{title}
					</span>
				</div>

				{desktopNav ? <DesktopTabs area={area} pathname={pathname} /> : null}

				{overrides.action ? <div className="flex shrink-0 items-center md:hidden">{overrides.action}</div> : null}

				{desktopNav ? <AccountMenu area={area} user={user} pathname={pathname} /> : null}
			</div>
		</header>
	);
}

function DesktopTabs({ area, pathname }: { area: AppRole; pathname: string }) {
	return (
		<nav aria-label="Primary" className="hidden min-w-0 flex-1 md:block">
			<ul className="flex items-center gap-1">
				{tabsFor(area).map((tab) => {
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
								<tab.icon className="size-[18px]" stroke={active ? 2.1 : 1.75} />
								{tab.label}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

function AccountMenu({ area, user, pathname }: { area: AppRole; user: ShellUser; pathname: string }) {
	const [open, setOpen] = useState(false);
	const cacheRefresh = useCacheRefreshController();
	const { LogoutButton, onLogout } = useLogoutButton();

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				aria-label="Account menu"
				className="hidden size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted md:inline-flex"
			>
				<Avatar className="size-8">
					<AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
						{formatInitials(user.name)}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-64">
				<UserSummary user={user} className="px-2 py-2" />
				<DropdownMenuSeparator />
				{moreLinksFor(area).map((link) => (
					<DropdownMenuItem
						key={link.href}
						render={
							<Link
								href={link.href}
								aria-current={isLinkActive(link, pathname) ? "page" : undefined}
								className="cursor-pointer"
							>
								<link.icon className="size-4" />
								{link.label}
							</Link>
						}
					/>
				))}
				<DropdownMenuSeparator />
				<cacheRefresh.RefreshButton
					onClick={cacheRefresh.refresh}
					render={<DropdownMenuItem closeOnClick={false} className={reactiveMenuItemClassName} />}
				/>
				<LogoutButton
					onClick={onLogout}
					render={<DropdownMenuItem variant="destructive" closeOnClick={false} className={reactiveMenuItemClassName} />}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
