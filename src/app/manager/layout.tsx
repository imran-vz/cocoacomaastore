import { RedirectType, redirect } from "next/navigation";

import { AppBarProvider } from "@/components/app-bar";
import { AppMain, shellVarsClassName } from "@/components/app-shell";
import { AppTopBar } from "@/components/app-top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { getServerSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
	const data = await getServerSession();

	if (!data || !data.session) {
		redirect("/login", RedirectType.replace);
	}

	if (data?.user.role === "admin") {
		redirect("/admin", RedirectType.replace);
	}

	const user = { name: data.user.name, email: data.user.email, role: data.user.role ?? "user" };

	return (
		<AppBarProvider>
			<div className={cn("page-texture page-texture-centered flex min-h-svh flex-col", shellVarsClassName)}>
				<AppTopBar area="manager" user={user} desktopNav />
				<AppMain>{children}</AppMain>
				<BottomNav area="manager" user={user} />
			</div>
		</AppBarProvider>
	);
}
