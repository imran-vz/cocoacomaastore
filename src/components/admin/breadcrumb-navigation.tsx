"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { routeInfo } from "@/components/app-nav";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

/**
 * Admin header breadcrumbs (md and up), labelled with the same names as the sidebar and tabs.
 * When the last crumb equals the page's own h1 (`pageTitle`), it is hidden while that heading
 * is visible (`pageTitleVisible`) so the screen is never named twice on screen.
 */
export function BreadcrumbNavigation({
	className,
	pageTitle,
	pageTitleVisible = false,
}: {
	className?: string;
	pageTitle?: string;
	pageTitleVisible?: boolean;
}) {
	const pathname = usePathname();
	const crumbs = routeInfo(pathname).crumbs;

	if (crumbs.length === 0) {
		return null;
	}

	const lastIsTitle = crumbs[crumbs.length - 1].label === pageTitle;
	const hideLast = lastIsTitle && pageTitleVisible;

	return (
		<Breadcrumb className={className}>
			<BreadcrumbList className="flex-nowrap">
				{crumbs.map((crumb, index) => {
					const isLast = index === crumbs.length - 1;
					const hidden = isLast && hideLast;

					return (
						<Fragment key={`${crumb.label}-${index}`}>
							<BreadcrumbItem
								aria-hidden={hidden || undefined}
								className={cn("min-w-0 transition-opacity duration-150", hidden && "pointer-events-none opacity-0")}
							>
								{isLast || !crumb.href ? (
									<BreadcrumbPage className="truncate font-semibold">{crumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink render={<Link href={crumb.href}>{crumb.label}</Link>} />
								)}
							</BreadcrumbItem>
							{!isLast && (
								<BreadcrumbSeparator
									className={cn(
										"transition-opacity duration-150",
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
