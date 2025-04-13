"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navLinks = [
	{ label: "Desserts", href: "/desserts" },
	{ label: "Orders", href: "/orders" },
];

export default function Navbar() {
	const pathname = usePathname();
	return (
		<div className="flex justify-between px-4 py-3 shadow items-center">
			<Link href="/">
				<h1 className="text-xl font-bold text-center">Cocoa Comaa</h1>
			</Link>
			<nav>
				<ul className="flex gap-4">
					{navLinks.map((link) => (
						<li key={link.href}>
							<Link
								className={cn(
									"text-sm font-medium",
									pathname.startsWith(link.href) && "underline",
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
	);
}
