"use client";

import { Check, ChevronRight, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { FEEDBACK_MS } from "@/components/ui/feedback";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { AREA_LABEL, LOGIN_PATH, type StaffUser } from "@/features/access/area";
import { authRequest, signOut } from "@/features/access/auth-client";
import { refreshAllData } from "@/features/shell/actions";
import { accountLinksFor, isLinkActive, type NavLink } from "@/features/shell/routes";
import { useRunAction } from "@/lib/action-result";
import { formatInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({ user, size = "sm" }: { user: StaffUser; size?: "sm" | "lg" }) {
	return (
		<Avatar size={size === "lg" ? "lg" : "default"}>
			<AvatarFallback className="bg-primary/10 font-semibold text-primary">{formatInitials(user.name)}</AvatarFallback>
		</Avatar>
	);
}

export function UserSummary({ user, className }: { user: StaffUser; className?: string }) {
	return (
		<div className={cn("flex min-w-0 items-center gap-3", className)}>
			<UserAvatar user={user} size="lg" />
			<div className="min-w-0 flex-1 leading-tight">
				<p className="truncate text-row">{user.name}</p>
				<p className="truncate text-meta text-muted-foreground">
					{AREA_LABEL[user.area]} · {user.email}
				</p>
			</div>
		</div>
	);
}

function useAccountActions() {
	const runAction = useRunAction();
	const [refreshing, RefreshButton] = useReactiveButton({
		label: "Refresh data",
		icon: RefreshCw,
		loading: { label: "Refreshing…" },
		success: { label: "Refreshed", icon: Check, duration: FEEDBACK_MS.inline },
		error: { label: "Refresh failed" },
	});
	const [loggingOut, LogoutButton] = useReactiveButton({
		label: "Log out",
		icon: LogOut,
		loading: { label: "Logging out…" },
	});

	const refresh = async () => {
		if (refreshing.status !== "idle") return;
		const token = refreshing.setLoading();
		const result = await runAction(refreshAllData());
		if (!result.ok) {
			refreshing.setError(undefined, { token });
			return;
		}
		refreshing.setSuccess(undefined, { token });
	};

	const logout = async () => {
		const token = loggingOut.setLoading();
		const outcome = await authRequest(signOut());
		if (!outcome.ok) {
			loggingOut.setError("Logout failed", { token });
			return;
		}
		window.location.href = LOGIN_PATH;
	};

	return { RefreshButton, refresh, LogoutButton, logout };
}

const sheetRowClass =
	"flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-medium text-foreground transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:bg-muted";

/** A navigation row in the More sheet. */
export function SheetLinkRow({
	link,
	active,
	onNavigate,
}: {
	link: NavLink;
	active: boolean;
	onNavigate?: () => void;
}) {
	return (
		<Link
			href={link.href}
			aria-current={active ? "page" : undefined}
			onClick={onNavigate}
			className={cn(sheetRowClass, active && "text-primary")}
		>
			<link.icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
			<span className="flex-1 truncate">{link.label}</span>
			<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}

/**
 * The account menu: the account's own pages, Refresh data and Log out. The same list renders
 * as dropdown items under the signed-in user (sidebar footer, manager top bar) or as rows in
 * the More sheet, which shows the user at its top.
 */
export function AccountMenu({
	user,
	variant,
	onNavigate,
}: {
	user: StaffUser;
	variant: "dropdown" | "sheet";
	onNavigate?: () => void;
}) {
	const pathname = usePathname();
	const { RefreshButton, refresh, LogoutButton, logout } = useAccountActions();
	const links = accountLinksFor(user.area);

	if (variant === "dropdown") {
		return (
			<>
				<UserSummary user={user} className="px-2 py-2" />
				<DropdownMenuSeparator />
				{links.map((link) => (
					<DropdownMenuItem
						key={link.href}
						render={
							<Link
								href={link.href}
								aria-current={isLinkActive(link, pathname) ? "page" : undefined}
								className="cursor-pointer"
							>
								<link.icon />
								{link.label}
							</Link>
						}
					/>
				))}
				<RefreshButton
					onClick={refresh}
					align="start"
					render={<DropdownMenuItem closeOnClick={false} className="cursor-pointer" />}
				/>
				<DropdownMenuSeparator />
				<LogoutButton
					onClick={logout}
					align="start"
					render={<DropdownMenuItem variant="destructive" closeOnClick={false} className="cursor-pointer" />}
				/>
			</>
		);
	}

	return (
		<div className="surface-card overflow-hidden divide-y">
			{links.map((link) => (
				<SheetLinkRow key={link.href} link={link} active={isLinkActive(link, pathname)} onNavigate={onNavigate} />
			))}
			<RefreshButton
				onClick={refresh}
				align="start"
				render={<button type="button" className={cn(sheetRowClass, "[&_svg]:size-5 [&_svg]:text-muted-foreground")} />}
			/>
			<LogoutButton
				onClick={logout}
				align="start"
				render={<button type="button" className={cn(sheetRowClass, "text-destructive [&_svg]:size-5")} />}
			/>
		</div>
	);
}
