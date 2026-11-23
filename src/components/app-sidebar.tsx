"use client";

import Link from "next/link";
import type * as React from "react";

import { adminSidebar } from "@/components/app-nav";
import { BrandLogo } from "@/components/brand-lockup";
import type { ShellUser } from "@/components/more-sheet";
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

/** Admin desktop/tablet sidebar (≥ md). Below md the admin uses the shared top bar + bottom tabs. */
export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: ShellUser }) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip="Cocoa Comaa"
							render={
								<Link href="/admin">
									<span className="flex size-8 shrink-0 items-center justify-center">
										<BrandLogo size={32} />
									</span>
									<span className="grid flex-1 text-left leading-tight">
										<span className="truncate text-[15px] font-bold tracking-tight text-primary">Cocoa Comaa</span>
										<span className="truncate text-xs text-muted-foreground">Admin</span>
									</span>
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={adminSidebar} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
