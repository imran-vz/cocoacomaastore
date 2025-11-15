"use client";

import { IconCakeRoll, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient, signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { TextRoll } from "./ui/text-roll";

export default function Navbar() {
	const { data: session } = authClient.useSession();
	const pathname = usePathname();

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
		<div className="shadow-md z-50 sticky top-0 bg-white">
			<div className="flex justify-between px-3 sm:px-4 md:px-6 py-3 items-center max-w-7xl mx-auto">
				<Link href="/">
					<TextRoll
						transition={{
							repeat: Number.POSITIVE_INFINITY,
							repeatType: "loop",
							repeatDelay: 10,
						}}
						className="text-xl text-primary font-bold dark:text-white"
					>
						Cocoa Comaa
					</TextRoll>
				</Link>

				{session?.user.id && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full"
								type="button"
							>
								<Avatar>
									<AvatarFallback>
										{getInitials(session.user.name)}
									</AvatarFallback>
								</Avatar>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuItem asChild>
								<Link href="/desserts" className="cursor-pointer">
									<IconCakeRoll />
									Desserts
								</Link>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								onClick={async () => {
									await signOut();
									window.location.href = "/login";
								}}
								className="cursor-pointer"
							>
								<IconLogout />
								Log out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</div>
		</div>
	);
}
