"use client";

import {
	IconChartBar,
	IconChartPie,
	IconDashboard,
	IconDatabase,
	IconFileDescription,
	IconPackage,
	IconShoppingCart,
	IconUsers,
} from "@tabler/icons-react";
import Image from "next/image";
import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

const data = {
	navMain: [
		{ title: "Home", url: "/admin", icon: IconDashboard },
		{ title: "Dashboard", url: "/admin/dashboard", icon: IconChartBar },
		{ title: "Analytics", url: "/admin/analytics", icon: IconChartPie },
		{ title: "Orders", url: "/admin/orders", icon: IconShoppingCart },
		{ title: "Desserts", url: "/admin/desserts", icon: IconFileDescription },
		{ title: "Combos", url: "/admin/combos", icon: IconPackage },
		{ title: "Managers", url: "/admin/managers", icon: IconUsers },
		{ title: "UPI Accounts", url: "/admin/upi", icon: IconDatabase },
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const session = authClient.useSession();

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							asChild
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<a href="/admin">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<Image
										src="/logo.png"
										alt="Cocoacomaa Store"
										width={32}
										height={32}
										className="rounded-lg"
									/>
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">Cocoa Comaa</span>
									<span className="truncate text-xs">Admin Panel</span>
								</div>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser
					user={
						session.data?.user || {
							name: "Admin",
							email: "admin@cocoacomaa.com",
						}
					}
				/>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
