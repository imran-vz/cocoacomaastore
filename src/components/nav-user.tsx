"use client";

import { IconSelector, IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import {
	CacheRefreshMenuItem,
	reactiveMenuItemClassName,
	useCacheRefreshController,
} from "@/components/cache-refresh-menu-item";
import { type ShellUser, UserSummary, useLogoutButton } from "@/components/more-sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { formatInitials, roleLabel } from "@/lib/format";

/** Admin sidebar footer: who is signed in + Settings, Refresh data, Log out. */
export function NavUser({ user }: { user: ShellUser }) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const cacheRefresh = useCacheRefreshController();
	const { LogoutButton, onLogout } = useLogoutButton();
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<Avatar className="size-8">
									<AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
										{formatInitials(user.name)}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{user.name}</span>
									<span className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
								</div>
								<IconSelector className="ml-auto size-4 text-muted-foreground" />
							</SidebarMenuButton>
						}
					/>

					<DropdownMenuContent
						className="w-(--anchor-width) min-w-60 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<UserSummary user={user} className="px-2 py-2" />
						<DropdownMenuSeparator />
						<DropdownMenuItem
							render={
								<Link href="/admin/settings" className="cursor-pointer">
									<IconSettings />
									Settings
								</Link>
							}
						/>
						<CacheRefreshMenuItem button={cacheRefresh.RefreshButton} onRefresh={cacheRefresh.refresh} />
						<DropdownMenuSeparator />
						<LogoutButton
							onClick={onLogout}
							render={
								<DropdownMenuItem variant="destructive" closeOnClick={false} className={reactiveMenuItemClassName} />
							}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
