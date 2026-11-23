"use client";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BRAND_NAME, BrandLogo, BrandWordmark } from "@/components/ui/brand";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { AREA_LABEL, homeOf, type StaffUser } from "@/features/access/area";
import { AccountMenu, UserAvatar } from "@/features/shell/account-menu";
import { isLinkActive, sidebarFor } from "@/features/shell/routes";

/** The admin's navigation from md up; below md the admin uses the top bar and tab bar. */
export function AppSidebar({ user }: { user: StaffUser }) {
	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip={BRAND_NAME}
							render={
								<Link href={homeOf(user.area)}>
									<span className="flex size-8 shrink-0 items-center justify-center">
										<BrandLogo size={32} />
									</span>
									<span className="grid flex-1 text-left leading-tight">
										<BrandWordmark className="truncate text-[15px]" />
										<span className="truncate text-xs text-muted-foreground">{AREA_LABEL[user.area]}</span>
									</span>
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarNav user={user} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarAccount user={user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

function SidebarNav({ user }: { user: StaffUser }) {
	const pathname = usePathname();
	const { state } = useSidebar();

	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu className="gap-0.5">
					{sidebarFor(user.area).map((item) => {
						const activeChild = item.items.some((child) => isLinkActive(child, pathname));
						// A section highlights itself only when none of its visible children carries the highlight.
						const isActive =
							isLinkActive(item, pathname) && (item.items.length === 0 || state === "collapsed" || !activeChild);

						return (
							<SidebarMenuItem key={item.href}>
								<SidebarMenuButton
									tooltip={item.label}
									isActive={isActive}
									render={
										<Link href={item.href} aria-current={isActive ? "page" : undefined}>
											<item.icon />
											<span>{item.label}</span>
										</Link>
									}
								/>
								{item.items.length > 0 ? (
									<SidebarMenuSub>
										{item.items.map((child) => {
											const childActive = isLinkActive(child, pathname);
											return (
												<SidebarMenuSubItem key={child.href}>
													<SidebarMenuSubButton
														isActive={childActive}
														render={
															<Link href={child.href} aria-current={childActive ? "page" : undefined}>
																<span>{child.label}</span>
															</Link>
														}
													/>
												</SidebarMenuSubItem>
											);
										})}
									</SidebarMenuSub>
								) : null}
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

function SidebarAccount({ user }: { user: StaffUser }) {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<UserAvatar user={user} />
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{user.name}</span>
									<span className="truncate text-xs text-muted-foreground">{AREA_LABEL[user.area]}</span>
								</div>
								<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
							</SidebarMenuButton>
						}
					/>
					<DropdownMenuContent
						className="w-(--anchor-width) min-w-60 rounded-lg"
						side="right"
						align="end"
						sideOffset={4}
					>
						<AccountMenu user={user} variant="dropdown" />
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
