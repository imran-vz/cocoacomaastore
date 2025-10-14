"use client";

import {
	IconDashboard,
	IconDatabase,
	IconFileDescription,
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
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { TextRoll } from "./ui/text-roll";

const data = {
	navMain: [
		{ title: "Dashboard", url: "/admin", icon: IconDashboard },
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
								<span className="flex items-center object-cover size-8 rounded-full overflow-hidden">
									<Image
										src="/logo.png"
										alt="Cocoacomaa Store"
										width={32}
										height={32}
									/>
								</span>
								<TextRoll
									transition={{
										repeat: Number.POSITIVE_INFINITY,
										repeatType: "loop",
										repeatDelay: 10,
									}}
									className="text-base text-primary min-w-32 font-bold dark:text-white"
								>
									Cocoa Comaa
								</TextRoll>
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
