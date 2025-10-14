"use client";

import {
	IconDatabase,
	IconFileDescription,
	IconInnerShadowTop,
	IconUsers,
} from "@tabler/icons-react";
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
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

const data = {
	navMain: [
		{ title: "Desserts", url: "/admin/desserts", icon: IconFileDescription },
		{ title: "Managers", url: "/admin/managers", icon: IconUsers },
		{ title: "UPI Accounts", url: "/admin/upi", icon: IconDatabase },
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const session = authClient.useSession();

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:!p-1.5"
						>
							<a href="/admin">
								<IconInnerShadowTop className="!size-5" />
								<span className="text-base font-semibold">
									Cocoacomaa Store
								</span>
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
		</Sidebar>
	);
}
