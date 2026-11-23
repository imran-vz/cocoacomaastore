"use client";

import { Ellipsis, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { OverlayContent, OverlayDescription, OverlayHeader, OverlayRoot } from "@/components/ui/overlay";
import type { StaffUser } from "@/features/access/area";
import { AccountMenu, SheetLinkRow, UserSummary } from "@/features/shell/account-menu";
import { activeTabHref, isLinkActive, moreLinksFor, tabsFor } from "@/features/shell/routes";
import { cn } from "@/lib/utils";

/**
 * Mobile tab bar (< md), the same for both areas. Its height is published as
 * `--bottom-nav-height` by the shell so the POS cart bar and the SaveBar sit directly above it.
 */
export function BottomNav({ user }: { user: StaffUser }) {
	const pathname = usePathname();
	const [moreOpen, setMoreOpen] = useState(false);
	const active = activeTabHref(user.area, pathname);

	return (
		<>
			<nav
				aria-label="Primary"
				data-slot="bottom-nav"
				className="fixed inset-x-0 bottom-0 z-bar border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				<ul className="mx-auto flex h-(--bar-height) max-w-lg items-stretch">
					{tabsFor(user.area).map((tab) => (
						<li key={tab.href} className="flex-1">
							<Link href={tab.href} aria-current={active === tab.href ? "page" : undefined} className={tabClass}>
								<TabContent icon={tab.icon} label={tab.label} active={active === tab.href} />
							</Link>
						</li>
					))}
					<li className="flex-1">
						<button
							type="button"
							aria-haspopup="dialog"
							aria-expanded={moreOpen}
							onClick={() => setMoreOpen(true)}
							className={tabClass}
						>
							<TabContent icon={Ellipsis} label="More" active={active === "more" || moreOpen} />
						</button>
					</li>
				</ul>
			</nav>
			<MoreSheet user={user} open={moreOpen} onOpenChange={setMoreOpen} />
		</>
	);
}

const tabClass =
	"group flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide transition-colors focus-visible:outline-none";

function TabContent({ icon: TabIcon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
	return (
		<>
			<span
				className={cn(
					"flex h-7 w-12 items-center justify-center rounded-full transition-colors focus-ring-group",
					active ? "bg-primary/10 text-primary" : "text-muted-foreground group-active:bg-muted",
				)}
			>
				<TabIcon className="size-[22px]" strokeWidth={active ? 2.1 : 1.75} />
			</span>
			<span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
		</>
	);
}

function MoreSheet({
	user,
	open,
	onOpenChange,
}: {
	user: StaffUser;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const pathname = usePathname();
	const links = moreLinksFor(user.area);
	const close = () => onOpenChange(false);

	return (
		<OverlayRoot open={open} onOpenChange={onOpenChange}>
			<OverlayContent shape="sheet" className="max-h-[85svh] overflow-y-auto bg-background pb-safe-3 md:hidden">
				<OverlayHeader title="More" className="sticky top-0 z-10 bg-background" />
				<OverlayDescription className="sr-only">More destinations and account actions</OverlayDescription>
				<div className="space-y-4 px-4">
					<div className="surface-card px-4 py-3">
						<UserSummary user={user} />
					</div>
					{links.length > 0 ? (
						<nav aria-label="More" className="surface-card overflow-hidden">
							<ul className="divide-y">
								{links.map((link) => (
									<li key={link.href}>
										<SheetLinkRow link={link} active={isLinkActive(link, pathname)} onNavigate={close} />
									</li>
								))}
							</ul>
						</nav>
					) : null}
					<AccountMenu user={user} variant="sheet" onNavigate={close} />
				</div>
			</OverlayContent>
		</OverlayRoot>
	);
}
