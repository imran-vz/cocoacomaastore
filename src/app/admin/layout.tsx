import { AppShell } from "@/features/shell/app-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	return <AppShell area="admin">{children}</AppShell>;
}
