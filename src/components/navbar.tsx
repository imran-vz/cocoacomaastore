"use client";

import {
	IconCakeRoll,
	IconComponents,
	IconFileDescription,
	IconLogout,
	IconMenu2,
	IconSettings,
} from "@tabler/icons-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient, signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function Navbar() {
	const { data: session } = authClient.useSession();
	const pathname = usePathname();

	// Hide navbar on admin routes (admin has its own sidebar)
	if (pathname.startsWith("/admin")) {
		return null;
	}

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.slice(0, 2)
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	return (
		<motion.header
			initial={{ y: -20, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
			className={cn(
				"sticky top-0 z-50 h-13",
				"bg-background/80 backdrop-blur-lg",
				"border-b border-border/50",
				"supports-backdrop-filter:bg-background/60",
			)}
		>
			<div className="h-full flex items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
				{/* Logo */}
				<Link href="/manager" className="flex items-center gap-2 group">
					<motion.div
						whileHover={{ rotate: [0, -10, 10, -5, 0] }}
						transition={{ duration: 0.5 }}
						className="text-2xl"
					>
						🧁
					</motion.div>
					<span className="text-lg font-bold text-primary group-hover:text-primary/80 transition-colors">
						Cocoa Comaa
					</span>
				</Link>

				{/* Right Side - User Menu */}
				{session?.user.id && (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<motion.button
									whileTap={{ scale: 0.95 }}
									className={cn(
										"flex items-center gap-2 p-1.5 pr-3 rounded-full",
										"bg-muted/50 hover:bg-muted transition-colors",
										"focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
									)}
									type="button"
								>
									<Avatar className="size-7">
										<AvatarFallback className="text-xs bg-primary text-primary-foreground">
											{getInitials(session.user.name)}
										</AvatarFallback>
									</Avatar>
									<IconMenu2 className="size-4 text-muted-foreground" />
								</motion.button>
							}
						/>
						<DropdownMenuContent align="end" className="w-56">
							{/* User Info Header */}
							<div className="px-2 py-2 border-b mb-1">
								<p className="text-sm font-medium truncate">
									{session.user.name}
								</p>
								<p className="text-xs text-muted-foreground truncate">
									{session.user.email}
								</p>
							</div>

							<DropdownMenuItem
								render={
									<Link href="/manager/desserts" className="cursor-pointer">
										<IconCakeRoll className="size-4" />
										Desserts & Stock
									</Link>
								}
							/>

							<DropdownMenuItem
								render={
									<Link href="/manager/combos" className="cursor-pointer">
										<IconComponents className="size-4" />
										Combos
									</Link>
								}
							/>

							<DropdownMenuItem
								render={
									<Link href="/manager/orders" className="cursor-pointer">
										<IconFileDescription className="size-4" />
										Orders
									</Link>
								}
							/>

							<DropdownMenuSeparator />

							<DropdownMenuItem
								render={
									<Link href="/manager/settings" className="cursor-pointer">
										<IconSettings className="size-4" />
										Settings
									</Link>
								}
							/>

							<DropdownMenuSeparator />

							<DropdownMenuItem
								variant="destructive"
								onClick={async () => {
									await signOut();
									window.location.href = "/login";
								}}
								className="cursor-pointer"
							>
								<IconLogout className="size-4" />
								Log out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</motion.header>
	);
}
