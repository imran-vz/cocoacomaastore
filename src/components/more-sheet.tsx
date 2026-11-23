"use client";

import { IconChevronRight, IconLogout, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { type AppRole, isLinkActive, moreLinksFor } from "@/components/app-nav";
import { useCacheRefreshController } from "@/components/cache-refresh-menu-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { formatInitials, roleLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ShellUser = { name: string; email: string; role?: string | null };

/** Shared "Log out" reactive button (More sheet, account menus). */
export function useLogoutButton() {
	const [logout, LogoutButton] = useReactiveButton({
		label: "Log out",
		icon: IconLogout,
		loading: { label: "Logging out…" },
		feedbackStyle: "neutral",
	});

	const onLogout = async () => {
		const token = logout.setLoading();
		try {
			await signOut();
			window.location.href = "/login";
		} catch (error) {
			console.error("Logout error:", error);
			logout.setError("Logout failed", { token });
		}
	};

	return { LogoutButton, onLogout };
}

export const listRowClass =
	"flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-medium text-foreground transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:bg-muted";

// ReactiveButton wraps its icon + label in nested spans; give them the list-row rhythm.
const reactiveRowClass = cn(
	listRowClass,
	"disabled:opacity-100 [&>span]:place-items-start [&>span>span]:gap-3 [&_svg]:size-5 [&_svg]:text-muted-foreground",
);

export function UserSummary({ user, className }: { user: ShellUser; className?: string }) {
	return (
		<div className={cn("flex min-w-0 items-center gap-3", className)}>
			<Avatar className="size-10">
				<AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
					{formatInitials(user.name)}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 leading-tight">
				<p className="truncate text-[15px] font-semibold">{user.name}</p>
				<p className="truncate text-[13px] text-muted-foreground">
					{roleLabel(user.role)} · {user.email}
				</p>
			</div>
		</div>
	);
}

export function MoreSheet({
	area,
	user,
	open,
	onOpenChange,
}: {
	area: AppRole;
	user: ShellUser;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const pathname = usePathname();
	const cacheRefresh = useCacheRefreshController();
	const { LogoutButton, onLogout } = useLogoutButton();
	const links = moreLinksFor(area);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showCloseButton={false}
				className="max-h-[85svh] gap-0 overflow-y-auto rounded-t-2xl border-t-0 bg-background pb-[max(env(safe-area-inset-bottom),12px)] md:hidden"
			>
				<div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25" />
				<div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background px-4 pt-1 pb-2">
					<div className="min-w-0">
						<SheetTitle className="text-[17px] font-semibold">More</SheetTitle>
						<SheetDescription className="sr-only">More destinations and account actions</SheetDescription>
					</div>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						aria-label="Close"
						className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
					>
						<IconX className="size-5" />
					</button>
				</div>

				<div className="space-y-4 px-4">
					<div className="rounded-xl border bg-card px-4 py-3">
						<UserSummary user={user} />
					</div>

					<nav aria-label="More" className="overflow-hidden rounded-xl border bg-card">
						<ul className="divide-y">
							{links.map((link) => {
								const active = isLinkActive(link, pathname);
								return (
									<li key={link.href}>
										<Link
											href={link.href}
											aria-current={active ? "page" : undefined}
											onClick={() => onOpenChange(false)}
											className={cn(listRowClass, active && "text-primary")}
										>
											<link.icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
											<span className="flex-1 truncate">{link.label}</span>
											<IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					<div className="overflow-hidden rounded-xl border bg-card divide-y">
						<cacheRefresh.RefreshButton
							onClick={cacheRefresh.refresh}
							render={<button type="button" className={reactiveRowClass} />}
						/>
						<LogoutButton
							onClick={onLogout}
							render={
								<button type="button" className={cn(reactiveRowClass, "text-destructive [&_svg]:text-destructive")} />
							}
						/>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
