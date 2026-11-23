"use client";

import { type Icon, IconDots } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { type AppRole, activeTabHref, tabsFor } from "@/components/app-nav";
import { MoreSheet, type ShellUser } from "@/components/more-sheet";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom tab bar (< md), same component for both roles.
 * 56px + safe area; the height is published as `--bottom-nav-height` by the shell so the
 * POS cart bar and the SaveBar can sit directly above it.
 * z-30: below the cart sheet's backdrop (z-40) and every dialog/sheet (z-50), so nothing
 * opens on top of an open cart sheet.
 */
export function BottomNav({ area, user }: { area: AppRole; user: ShellUser }) {
	const pathname = usePathname();
	const [moreOpen, setMoreOpen] = useState(false);
	const active = activeTabHref(area, pathname);

	return (
		<>
			<nav
				aria-label="Primary"
				data-slot="bottom-nav"
				className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<ul className="mx-auto flex h-14 max-w-lg items-stretch">
					{tabsFor(area).map((tab) => (
						<li key={tab.href} className="flex-1">
							<TabLink href={tab.href} label={tab.label} icon={tab.icon} active={active === tab.href} />
						</li>
					))}
					<li className="flex-1">
						<TabButton
							label="More"
							icon={IconDots}
							active={active === "more" || moreOpen}
							expanded={moreOpen}
							onClick={() => setMoreOpen(true)}
						/>
					</li>
				</ul>
			</nav>
			<MoreSheet area={area} user={user} open={moreOpen} onOpenChange={setMoreOpen} />
		</>
	);
}

const tabClass =
	"group flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide transition-colors focus-visible:outline-none";

function TabContent({ icon: TabIcon, label, active }: { icon: Icon; label: string; active: boolean }) {
	return (
		<>
			<span
				className={cn(
					"flex h-7 w-12 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring/50",
					active ? "bg-primary/10 text-primary" : "text-muted-foreground group-active:bg-muted",
				)}
			>
				<TabIcon className="size-[22px]" stroke={active ? 2.1 : 1.75} />
			</span>
			<span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
		</>
	);
}

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: Icon; active: boolean }) {
	return (
		<Link href={href} aria-current={active ? "page" : undefined} className={tabClass}>
			<TabContent icon={icon} label={label} active={active} />
		</Link>
	);
}

function TabButton({
	label,
	icon,
	active,
	expanded,
	onClick,
}: {
	label: string;
	icon: Icon;
	active: boolean;
	expanded: boolean;
	onClick: () => void;
}) {
	return (
		<button type="button" aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick} className={tabClass}>
			<TabContent icon={icon} label={label} active={active} />
		</button>
	);
}
