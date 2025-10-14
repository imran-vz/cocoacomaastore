import { headers } from "next/headers";
import { RedirectType, redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const data = await auth.api.getSession({ headers: await headers() });

	if (!data?.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data?.user.role !== "admin") {
		redirect("/", RedirectType.replace);
	}

	return (
		<div className="flex min-h-[calc(100vh-52px)] flex-col">
			<SidebarProvider
				style={
					{
						"--sidebar-width": "calc(var(--spacing) * 72)",
						"--header-height": "calc(var(--spacing) * 12)",
					} as React.CSSProperties
				}
			>
				<AppSidebar variant="inset" />
				<SidebarInset>
					<SiteHeader />
					<div className="md:px-4 md:py-6">{children}</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
