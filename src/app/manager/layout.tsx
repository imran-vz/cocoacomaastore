import { AppShell } from "@/features/shell/app-shell";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
	return <AppShell area="manager">{children}</AppShell>;
}
