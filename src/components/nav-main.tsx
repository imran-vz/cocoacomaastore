"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isLinkActive, type SidebarNavItem } from "@/components/app-nav";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";

export function NavMain({ items }: { items: SidebarNavItem[] }) {
	const pathname = usePathname();
	const { setOpenMobile, isMobile, state } = useSidebar();

	const handleLinkClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu className="gap-0.5">
					{items.map((item) => {
						const children = item.items ?? [];
						const activeChild = children.some((child) => isLinkActive({ ...child, exact: true }, pathname));
						// A section highlights itself only when none of its visible children carries the highlight.
						const isActive =
							isLinkActive(item, pathname) && (children.length === 0 || state === "collapsed" || !activeChild);

						return (
							<SidebarMenuItem key={item.href}>
								<SidebarMenuButton
									tooltip={item.label}
									isActive={isActive}
									render={
										<Link href={item.href} onClick={handleLinkClick} aria-current={isActive ? "page" : undefined}>
											<item.icon />
											<span>{item.label}</span>
										</Link>
									}
								/>
								{children.length > 0 && (
									<SidebarMenuSub>
										{children.map((child) => {
											const childActive = isLinkActive({ ...child, exact: true }, pathname);
											return (
												<SidebarMenuSubItem key={child.href}>
													<SidebarMenuSubButton
														isActive={childActive}
														render={
															<Link
																href={child.href}
																onClick={handleLinkClick}
																aria-current={childActive ? "page" : undefined}
															>
																<span>{child.label}</span>
															</Link>
														}
													/>
												</SidebarMenuSubItem>
											);
										})}
									</SidebarMenuSub>
								)}
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
