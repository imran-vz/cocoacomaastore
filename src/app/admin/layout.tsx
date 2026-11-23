import { cookies } from "next/headers";
import { RedirectType, redirect } from "next/navigation";

import { AppBarProvider } from "@/components/app-bar";
import { AppMain, shellVarsClassName } from "@/components/app-shell";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopBar } from "@/components/app-top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const data = await getServerSession();

	if (!data?.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data?.user.role !== "admin") {
		redirect("/", RedirectType.replace);
	}

	const user = { name: data.user.name, email: data.user.email, role: data.user.role };
	// Respect the collapsed/expanded choice the sidebar stores in its cookie.
	const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

	return (
		<AppBarProvider>
			<SidebarProvider
				defaultOpen={sidebarOpen}
				className={cn(shellVarsClassName, "md:[--shell-chrome-y:1rem]")}
				style={
					{
						"--sidebar-width": "calc(var(--spacing) * 64)",
						"--header-height": "calc(var(--spacing) * 14)",
					} as React.CSSProperties
				}
			>
				<AppSidebar variant="inset" user={user} />
				<SidebarInset className="page-texture min-w-0">
					<AppTopBar area="admin" user={user} />
					<SiteHeader />
					<AppMain>{children}</AppMain>
				</SidebarInset>
				<BottomNav area="admin" user={user} />
			</SidebarProvider>
		</AppBarProvider>
	);
}
