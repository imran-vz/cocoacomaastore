import { PageFrame } from "@/components/page-frame";

type AdminPageShellProps = {
	children: React.ReactNode;
	/** `narrow` (max-w-3xl) for lists and forms, `wide` (max-w-7xl, default) for data. */
	frame?: "narrow" | "wide";
	className?: string;
};

/**
 * Admin page container: a left-aligned `PageFrame` (never centred in the inset). The admin
 * layout's SidebarInset is already the `<main>` landmark, so this renders a `<div>`.
 */
export function AdminPageShell({ children, frame = "wide", className }: AdminPageShellProps) {
	return (
		<PageFrame frame={frame} className={className}>
			{children}
		</PageFrame>
	);
}
