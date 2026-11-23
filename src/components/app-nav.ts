import {
	type Icon,
	IconCake,
	IconChartBar,
	IconChartLine,
	IconPackage,
	IconQrcode,
	IconReceipt,
	IconSettings,
	IconShoppingBag,
	IconStack2,
	IconUsers,
} from "@tabler/icons-react";

/**
 * Navigation model shared by the mobile bottom tab bar, the More sheet, the manager
 * desktop header tabs, the admin sidebar, the admin breadcrumbs and the app bar title.
 * One list of labels and icons, so every surface names a destination the same way.
 */

export type AppRole = "admin" | "manager";

export type NavLink = {
	label: string;
	href: string;
	icon: Icon;
	/** Path prefixes that make this link active. Defaults to `[href]`. */
	match?: string[];
	/** Only the exact `href` makes it active (used for the role home). */
	exact?: boolean;
};

export type SidebarNavItem = NavLink & { items?: NavLink[] };

type RouteInfo = {
	/** Title shown in the app bar once the page's own heading scrolls away. */
	title: string;
	/** Breadcrumb trail (admin, ≥ lg). The last entry is the current page. */
	crumbs: { label: string; href?: string }[];
	/** Sub-pages show a back chevron instead of the logo. */
	back?: { href: string; label: string };
	/** The role home shows the brand wordmark instead of a title. */
	home?: boolean;
};

const sell = (base: string): NavLink => ({ label: "Sell", href: base, icon: IconShoppingBag, exact: true });

export const managerTabs: NavLink[] = [
	sell("/manager"),
	{ label: "Orders", href: "/manager/orders", icon: IconReceipt },
	{ label: "Stock", href: "/manager/inventory", icon: IconPackage },
	{ label: "Catalog", href: "/manager/desserts", icon: IconCake, match: ["/manager/desserts", "/manager/combos"] },
];

export const managerMoreLinks: NavLink[] = [
	{ label: "Combos", href: "/manager/combos", icon: IconStack2 },
	{ label: "Settings", href: "/manager/settings", icon: IconSettings },
];

export const adminTabs: NavLink[] = [
	sell("/admin"),
	{ label: "Orders", href: "/admin/orders", icon: IconReceipt },
	{ label: "Insights", href: "/admin/dashboard", icon: IconChartBar, match: ["/admin/dashboard", "/admin/analytics"] },
	{ label: "Catalog", href: "/admin/desserts", icon: IconCake, match: ["/admin/desserts", "/admin/combos"] },
];

export const adminMoreLinks: NavLink[] = [
	{ label: "Monthly insights", href: "/admin/analytics", icon: IconChartLine },
	{ label: "Combos", href: "/admin/combos", icon: IconStack2 },
	{ label: "Managers", href: "/admin/settings/managers", icon: IconUsers, match: ["/admin/settings/managers"] },
	{ label: "UPI accounts", href: "/admin/settings/upi", icon: IconQrcode, match: ["/admin/settings/upi"] },
	{ label: "Settings", href: "/admin/settings", icon: IconSettings, exact: true },
];

/** Admin desktop sidebar: the tab labels as sections, the segmented-control labels as children. */
export const adminSidebar: SidebarNavItem[] = [
	adminTabs[0],
	adminTabs[1],
	{
		...adminTabs[2],
		items: [
			{ label: "Day", href: "/admin/dashboard", icon: IconChartBar },
			{ label: "Month", href: "/admin/analytics", icon: IconChartLine },
		],
	},
	{
		...adminTabs[3],
		items: [
			{ label: "Desserts", href: "/admin/desserts", icon: IconCake },
			{ label: "Combos", href: "/admin/combos", icon: IconStack2 },
		],
	},
	{
		label: "Settings",
		href: "/admin/settings",
		icon: IconSettings,
		match: ["/admin/settings"],
		items: [
			{ label: "Managers", href: "/admin/settings/managers", icon: IconUsers },
			{ label: "UPI accounts", href: "/admin/settings/upi", icon: IconQrcode },
		],
	},
];

export function tabsFor(role: AppRole): NavLink[] {
	return role === "admin" ? adminTabs : managerTabs;
}

export function moreLinksFor(role: AppRole): NavLink[] {
	return role === "admin" ? adminMoreLinks : managerMoreLinks;
}

export function homeFor(role: AppRole): string {
	return role === "admin" ? "/admin" : "/manager";
}

function normalize(pathname: string): string {
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function isLinkActive(link: NavLink, pathname: string): boolean {
	const path = normalize(pathname);
	if (link.exact) return path === link.href;
	return (link.match ?? [link.href]).some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** The "More" tab is active when no primary tab claims the route. */
export function activeTabHref(role: AppRole, pathname: string): string | "more" {
	const tab = tabsFor(role).find((link) => isLinkActive(link, pathname));
	return tab ? tab.href : "more";
}

const routes: Record<string, RouteInfo> = {
	"/manager": { title: "Sell", crumbs: [{ label: "Sell" }], home: true },
	"/manager/orders": { title: "Orders", crumbs: [{ label: "Orders" }] },
	"/manager/inventory": { title: "Stock", crumbs: [{ label: "Stock" }] },
	"/manager/desserts": {
		title: "Catalog",
		crumbs: [{ label: "Catalog", href: "/manager/desserts" }, { label: "Desserts" }],
	},
	"/manager/combos": {
		title: "Catalog",
		crumbs: [{ label: "Catalog", href: "/manager/desserts" }, { label: "Combos" }],
	},
	"/manager/settings": { title: "Settings", crumbs: [{ label: "Settings" }] },
	"/admin": { title: "Sell", crumbs: [{ label: "Sell" }], home: true },
	"/admin/orders": { title: "Orders", crumbs: [{ label: "Orders" }] },
	"/admin/dashboard": {
		title: "Insights",
		crumbs: [{ label: "Insights", href: "/admin/dashboard" }, { label: "Day" }],
	},
	"/admin/analytics": {
		title: "Insights",
		crumbs: [{ label: "Insights", href: "/admin/dashboard" }, { label: "Month" }],
	},
	"/admin/desserts": {
		title: "Catalog",
		crumbs: [{ label: "Catalog", href: "/admin/desserts" }, { label: "Desserts" }],
	},
	"/admin/combos": { title: "Catalog", crumbs: [{ label: "Catalog", href: "/admin/desserts" }, { label: "Combos" }] },
	"/admin/settings": { title: "Settings", crumbs: [{ label: "Settings" }] },
	"/admin/settings/managers": {
		title: "Managers",
		crumbs: [{ label: "Settings", href: "/admin/settings" }, { label: "Managers" }],
		back: { href: "/admin/settings", label: "Settings" },
	},
	"/admin/settings/upi": {
		title: "UPI accounts",
		crumbs: [{ label: "Settings", href: "/admin/settings" }, { label: "UPI accounts" }],
		back: { href: "/admin/settings", label: "Settings" },
	},
};

/** Route info for a pathname; unknown deeper paths inherit from their nearest known parent. */
export function routeInfo(pathname: string): RouteInfo {
	let path = normalize(pathname);
	while (path.length > 0) {
		const info = routes[path];
		if (info) return info;
		path = path.slice(0, path.lastIndexOf("/"));
	}
	return { title: "Cocoa Comaa", crumbs: [] };
}
