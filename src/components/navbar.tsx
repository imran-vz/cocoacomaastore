"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { TextRoll } from "./ui/text-roll";

const navLinks = [{ label: "Desserts", href: "/desserts" }];

export default function Navbar() {
	const pathname = usePathname();

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
				<nav>
					<ul className="flex gap-4">
						{navLinks.map((link) => (
							<li key={link.href}>
								<Link
									className={cn(
										"text-sm font-medium",
										pathname.startsWith(link.href) && "underline text-primary",
									)}
									href={link.href}
								>
									{link.label}
								</Link>
							</li>
						))}
					</ul>
				</nav>
			</div>
		</div>
	);
}
