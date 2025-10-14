"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbSegment {
	label: string;
	href?: string;
}

// Map route segments to user-friendly labels
const segmentLabels: Record<string, string> = {
	admin: "Dashboard",
	desserts: "Desserts",
	orders: "Orders",
	customers: "Customers",
	users: "Users",
	managers: "Managers",
	workshops: "Workshops",
	"workshop-orders": "Workshop Orders",
	"postal-brownies": "Postal Brownies",
	"postal-orders": "Postal Orders",
	specials: "Specials",
	settings: "Settings",
	"order-days": "Order Days",
	new: "New",
	edit: "Edit",
};

function formatSegment(segment: string): string {
	// Check if we have a custom label
	if (segmentLabels[segment]) {
		return segmentLabels[segment];
	}

	// Check if it's an ID (UUID or numeric)
	if (
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			segment,
		) ||
		/^\d+$/.test(segment)
	) {
		return "Details";
	}

	// Default: capitalize and replace hyphens with spaces
	return segment
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function BreadcrumbNavigation() {
	const pathname = usePathname();

	// Split pathname into segments and filter out empty strings
	const segments = pathname.split("/").filter(Boolean);

	// Build breadcrumb items
	const breadcrumbs: BreadcrumbSegment[] = segments.map((segment, index) => {
		const href = `/${segments.slice(0, index + 1).join("/")}`;
		const label = formatSegment(segment);

		// Don't make the last segment a link (current page)
		const isLast = index === segments.length - 1;

		return {
			label,
			href: isLast ? undefined : href,
		};
	});

	// Don't show breadcrumbs on the main admin page
	if (breadcrumbs.length <= 1) {
		return null;
	}

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{breadcrumbs.map((breadcrumb, index) => {
					const isLast = index === breadcrumbs.length - 1;

					return (
						<Fragment key={breadcrumb.href || breadcrumb.label}>
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
								) : (
									<BreadcrumbLink asChild>
										<Link href={breadcrumb.href || "/"}>
											{breadcrumb.label}
										</Link>
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{!isLast && <BreadcrumbSeparator />}
						</Fragment>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
