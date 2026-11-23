import {
	Cake,
	ChartColumn,
	ChartLine,
	Layers,
	type LucideIcon,
	Package,
	QrCode,
	Receipt,
	Settings,
	ShoppingBag,
	Users,
} from "lucide-react";

import { BRAND_NAME } from "@/components/ui/brand";
import { AREAS, type Area, homeOf } from "@/features/access/area";

/**
 * Every staff screen, once. The tab bar, the More sheet, the account menus, the admin
 * sidebar, the breadcrumbs, the app bar title and back link, the settings rows, the
 * segmented links inside a section and each screen's content width all derive from it.
 */

/** Content width: `narrow` for lists and forms, `wide` for data, `bleed` for a screen that draws its own gutters. */
export type Frame = "narrow" | "wide" | "bleed";

type SectionId = "sell" | "orders" | "insights" | "stock" | "catalog" | "settings";

type Page = {
	href: string;
	label: string;
	icon: LucideIcon;
	/** Listed in the More sheet, under this label when it differs from `label`. */
	more?: true | string;
	/** One line describing the page: its document description, and its row where it is listed (settings). */
	description?: string;
};

type Section = {
	id: SectionId;
	label: string;
	icon: LucideIcon;
	/** The section's own screen described in one line (its document description; on settings, its heading). */
	description?: string;
	/** `tab`: a primary destination. `account`: reached from the account menu. */
	place: "tab" | "account";
	frame: Frame;
	/** A section with its own screen is a hub; its pages are sub-pages with a way back. */
	href?: string;
	/** Without an own screen, the pages are views of the section (a segmented switch). */
	pages?: Page[];
};

function sections(area: Area): Section[] {
	const home = homeOf(area);
	const sell: Section = { id: "sell", label: "Sell", icon: ShoppingBag, place: "tab", frame: "bleed", href: home };
	const orders: Section = {
		id: "orders",
		label: "Orders",
		icon: Receipt,
		place: "tab",
		frame: "wide",
		href: `${home}/orders`,
		description: area === "admin" ? "View and manage all orders" : "View and manage today's orders",
	};
	const catalog: Section = {
		id: "catalog",
		label: "Catalog",
		icon: Cake,
		place: "tab",
		frame: "narrow",
		pages: [
			{
				href: `${home}/desserts`,
				label: "Desserts",
				icon: Cake,
				description: "Desserts, visibility and today's stock",
			},
			{ href: `${home}/combos`, label: "Combos", icon: Layers, more: true, description: "Dessert combos" },
		],
	};

	if (area === "manager") {
		return [
			sell,
			orders,
			{
				id: "stock",
				label: "Stock",
				icon: Package,
				place: "tab",
				frame: "narrow",
				href: `${home}/inventory`,
				description: "Today's stock count",
			},
			catalog,
			{
				id: "settings",
				label: "Settings",
				icon: Settings,
				description: "Your account and password.",
				place: "account",
				frame: "narrow",
				href: `${home}/settings`,
			},
		];
	}

	return [
		sell,
		orders,
		{
			id: "insights",
			label: "Insights",
			icon: ChartColumn,
			place: "tab",
			frame: "wide",
			pages: [
				{
					href: `${home}/dashboard`,
					label: "Day",
					icon: ChartColumn,
					description: "One shop day's revenue, orders, stock levels and stock changes",
				},
				{
					href: `${home}/analytics`,
					label: "Month",
					icon: ChartLine,
					more: "Monthly insights",
					description: "Monthly revenue, revenue by Business Week, and top desserts",
				},
			],
		},
		catalog,
		{
			id: "settings",
			label: "Settings",
			icon: Settings,
			description: "Staff access, payment accounts and your sign-in.",
			place: "account",
			frame: "narrow",
			href: `${home}/settings`,
			pages: [
				{
					href: `${home}/settings/managers`,
					label: "Managers",
					icon: Users,
					more: true,
					description: "Invite, review and remove staff access",
				},
				{
					href: `${home}/settings/upi`,
					label: "UPI accounts",
					icon: QrCode,
					more: true,
					description: "Payment handles shown at checkout",
				},
			],
		},
	];
}

const MAP: Record<Area, Section[]> = { admin: sections("admin"), manager: sections("manager") };

export type NavLink = {
	label: string;
	href: string;
	icon: LucideIcon;
	/** Path prefixes that make this link active. */
	match: string[];
	/** Only the exact `href` makes it active (the area home, whose prefix is every route). */
	exact: boolean;
};

type SidebarItem = NavLink & { items: NavLink[] };

export type Crumb = { label: string; href?: string };

export type RouteInfo = {
	/** Title shown in the app bar once the page's own heading scrolls away. */
	title: string;
	/** Breadcrumb trail; the last entry is the current page. */
	crumbs: Crumb[];
	/** Sub-pages show a back link instead of the logo. */
	back?: { href: string; label: string };
	/** The area home shows the brand wordmark instead of a title. */
	home: boolean;
	frame: Frame;
	description?: string;
};

function sectionLink(area: Area, section: Section): NavLink {
	const href = section.href ?? section.pages?.[0]?.href ?? homeOf(area);
	const exact = href === homeOf(area);
	return {
		label: section.label,
		href,
		icon: section.icon,
		match: [...new Set([href, ...(section.pages ?? []).map((page) => page.href)])],
		exact,
	};
}

function pageLink(page: Page): NavLink {
	return { label: page.label, href: page.href, icon: page.icon, match: [page.href], exact: true };
}

export function tabsFor(area: Area): NavLink[] {
	return MAP[area].filter((section) => section.place === "tab").map((section) => sectionLink(area, section));
}

/** Links the account menu carries in every container (sidebar, top bar, More sheet). */
export function accountLinksFor(area: Area): NavLink[] {
	return MAP[area]
		.filter((section) => section.place === "account")
		.map((section) => ({ ...sectionLink(area, section), exact: true }));
}

/** Pages the tab bar doesn't name, listed in the More sheet. */
export function moreLinksFor(area: Area): NavLink[] {
	return MAP[area].flatMap((section) =>
		(section.pages ?? [])
			.filter((page) => page.more)
			.map((page) => ({ ...pageLink(page), label: typeof page.more === "string" ? page.more : page.label })),
	);
}

/** The admin sidebar: every section, with its pages as children. */
export function sidebarFor(area: Area): SidebarItem[] {
	return MAP[area].map((section) => ({
		...sectionLink(area, section),
		items: (section.pages ?? []).map(pageLink),
	}));
}

/** The views of one section, for its segmented switch (Desserts | Combos, Day | Month). */
export function sectionViews(area: Area, id: SectionId): { href: string; label: string }[] {
	const section = MAP[area].find((candidate) => candidate.id === id);
	return (section?.pages ?? []).map(({ href, label }) => ({ href, label }));
}

/** Where a section opens: its own screen, or else its first view (Catalog opens on Desserts). */
export function sectionHref(area: Area, id: SectionId): string {
	const section = MAP[area].find((candidate) => candidate.id === id);
	return section ? sectionLink(area, section).href : homeOf(area);
}

/** The settings screen's heading and its sub-pages, as rows on it. */
export function settingsHub(area: Area): {
	label: string;
	description?: string;
	pages: { href: string; label: string; icon: LucideIcon; description?: string }[];
} {
	const section = MAP[area].find((candidate) => candidate.id === "settings");
	return { label: section?.label ?? "Settings", description: section?.description, pages: section?.pages ?? [] };
}

function normalize(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isLinkActive(link: NavLink, pathname: string): boolean {
	const path = normalize(pathname);
	if (link.exact) return path === link.href;
	return link.match.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** The tab that owns the route, or "more" when no tab does. */
export function activeTabHref(area: Area, pathname: string): string | "more" {
	const tab = tabsFor(area).find((link) => isLinkActive(link, pathname));
	return tab ? tab.href : "more";
}

function routeTable(): Map<string, RouteInfo> {
	const table = new Map<string, RouteInfo>();
	for (const area of AREAS) {
		for (const section of MAP[area]) {
			const { href, label, frame, description } = section;
			if (href) table.set(href, { title: label, crumbs: [{ label }], home: href === homeOf(area), frame, description });
			for (const page of section.pages ?? []) {
				const parent = { label, href: href ?? sectionLink(area, section).href };
				const crumbs = [parent, { label: page.label }];
				table.set(
					page.href,
					href
						? { title: page.label, crumbs, back: { href, label }, home: false, frame, description: page.description }
						: { title: label, crumbs, home: false, frame, description: page.description },
				);
			}
		}
	}
	return table;
}

const ROUTES = routeTable();

/** Route info for a pathname; deeper paths inherit from their nearest named parent. */
export function routeInfo(pathname: string): RouteInfo {
	let path = normalize(pathname);
	while (path.length > 0) {
		const info = ROUTES.get(path);
		if (info) return info;
		path = path.slice(0, path.lastIndexOf("/"));
	}
	return { title: BRAND_NAME, crumbs: [], home: false, frame: "wide" };
}

/**
 * A screen's document metadata: its breadcrumb trail as the title ("Settings › UPI accounts"),
 * and its description.
 */
export function pageMetadata(pathname: string): { title: string; description?: string } {
	const { title, crumbs, description } = routeInfo(pathname);
	return { title: crumbs.length > 0 ? crumbs.map((crumb) => crumb.label).join(" › ") : title, description };
}
