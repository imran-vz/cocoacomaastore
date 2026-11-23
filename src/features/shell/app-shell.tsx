import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { sidebarOpenFrom } from "@/components/ui/sidebar-state";
import type { Area } from "@/features/access/area";
import { requireArea } from "@/features/access/session";
import { BottomNav } from "@/features/shell/bottom-nav";
import { ShellMain } from "@/features/shell/shell-main";
import { AppSidebar } from "@/features/shell/sidebar";
import { TopBar } from "@/features/shell/top-bar";
import { withDatabase } from "@/features/shell/with-database";

/**
 * Bar heights the shell publishes to everything inside it: `--app-bar-height` for anything
 * sticky under the top bar (`sticky top-(--app-bar-height)`), `--bottom-nav-height` for
 * anything fixed above the tab bar (`bottom-(--bottom-nav-height)`, 0 from md). They include
 * the iOS safe-area insets and are inherited, so portaled popups don't see them.
 */
const SHELL_VARS =
	"[--app-bar-height:calc(var(--bar-height)+env(safe-area-inset-top))] [--bottom-nav-height:calc(var(--bar-height)+env(safe-area-inset-bottom))] md:[--app-bar-height:var(--bar-height)] md:[--bottom-nav-height:0px]";

/**
 * The signed-in chrome around every staff screen. Admins get the sidebar from md; managers
 * keep the top bar with inline tabs. Signed-out visitors and staff from the other area are
 * redirected.
 */
export function AppShell({ area, children }: { area: Area; children: React.ReactNode }) {
	return withDatabase(requireArea(area), async (user) => {
		if (area !== "admin") {
			return (
				<div className={`page-texture page-texture-centered flex min-h-svh flex-col ${SHELL_VARS}`}>
					<TopBar user={user} layout="tabs" />
					<ShellMain centered>{children}</ShellMain>
					<BottomNav user={user} />
				</div>
			);
		}

		const sidebarOpen = sidebarOpenFrom(await cookies());
		return (
			<SidebarProvider defaultOpen={sidebarOpen} className={SHELL_VARS}>
				<AppSidebar user={user} />
				<SidebarInset className="page-texture min-w-0">
					<TopBar user={user} layout="sidebar" />
					<ShellMain centered={false}>{children}</ShellMain>
				</SidebarInset>
				<BottomNav user={user} />
			</SidebarProvider>
		);
	});
}
