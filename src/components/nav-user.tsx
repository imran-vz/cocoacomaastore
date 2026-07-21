"use client";

import { IconDotsVertical, IconLogout, IconSettings } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { CacheRefreshMenuItem, useCacheRefreshController } from "@/components/cache-refresh-menu-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

export function NavUser({
	user,
}: {
	user: {
		name: string;
		email: string;
	};
}) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const cacheRefresh = useCacheRefreshController();
	const [logout, LogoutButton] = useReactiveButton({
		label: "Log out",
		icon: IconLogout,
		loading: { label: "Logging out..." },
	});
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
								<Avatar className="h-8 w-8 rounded-lg grayscale">
									<AvatarFallback className="rounded-lg">{user.name.slice(0, 2)}</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">{user?.name}</span>
									<span className="text-muted-foreground truncate text-xs">{user.email}</span>
								</div>
								<IconDotsVertical className="ml-auto size-4" />
							</SidebarMenuButton>
						}
					/>

					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className="p-0 font-normal">
								<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarFallback className="rounded-lg">{user.name.slice(0, 2)}</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user.name}</span>
										<span className="text-muted-foreground truncate text-xs">{user.email}</span>
									</div>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<CacheRefreshMenuItem button={cacheRefresh.RefreshButton} onRefresh={cacheRefresh.refresh} />

						<DropdownMenuItem
							render={
								<Link href="/admin/settings" className="cursor-pointer">
									<IconSettings />
									Settings
								</Link>
							}
						/>

						<DropdownMenuSeparator />
						<LogoutButton
							render={<DropdownMenuItem closeOnClick={false} className="cursor-pointer" />}
							onClick={async () => {
								const token = logout.setLoading();
								try {
									await signOut();
									window.location.href = "/login";
								} catch (error) {
									console.error("Logout error:", error);
									logout.setError("Logout failed", { token });
								}
							}}
						/>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
