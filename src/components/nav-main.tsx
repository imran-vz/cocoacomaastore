"use client";

import type { Icon } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

type NavItem = {
	title: string;
	url: string;
	icon?: Icon;
	items?: NavItem[];
};

export function NavMain({ items }: { items: NavItem[] }) {
	const pathname = usePathname();
	const { setOpenMobile, isMobile } = useSidebar();

	const handleLinkClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarGroup>
			<SidebarGroupContent className="flex flex-col gap-2">
				<SidebarMenu>
					{items.map((item) => {
						const isActive = pathname === item.url || item.items?.some((child) => pathname === child.url);

						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									tooltip={item.title}
									isActive={isActive}
									render={
										<Link href={item.url} onClick={handleLinkClick}>
											{item.icon && <item.icon />}
											<span>{item.title}</span>
										</Link>
									}
								/>
								{item.items && item.items.length > 0 && (
									<SidebarMenuSub>
										{item.items.map((child) => (
											<SidebarMenuSubItem key={child.title}>
												<SidebarMenuSubButton
													isActive={pathname === child.url}
													render={
														<Link href={child.url} onClick={handleLinkClick}>
															{child.icon && <child.icon />}
															<span>{child.title}</span>
														</Link>
													}
												/>
											</SidebarMenuSubItem>
										))}
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
