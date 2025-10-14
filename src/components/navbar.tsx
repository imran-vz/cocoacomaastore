"use client";

import { IconCakeRoll, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient, signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { TextRoll } from "./ui/text-roll";

const navLinks = [{ label: "Desserts", href: "/desserts", icon: IconCakeRoll }];

export default function Navbar() {
	const { data: session } = authClient.useSession();
	const pathname = usePathname();

	if (pathname.startsWith("/admin")) {
		return null;
	}

	return (
		<div className="shadow-md z-10 sticky top-0 bg-white">
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
				<div>
					<nav className="mr-4">
						<ul className="flex gap-4">
							{navLinks.map((link) => (
								<li key={link.href}>
									<Link
										className={cn(
											"text-sm font-medium inline-flex items-center gap-1",
											pathname.startsWith(link.href) &&
												"underline text-primary",
										)}
										href={link.href}
									>
										{link.icon && <link.icon />}
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</nav>

					{session?.user.id && (
						<Button
							onClick={async () => {
								await signOut();
								window.location.href = "/login";
							}}
						>
							<IconLogout />
							Log out
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
