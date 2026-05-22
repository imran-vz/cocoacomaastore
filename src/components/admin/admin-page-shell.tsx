import { cn } from "@/lib/utils";

type AdminPageShellProps = {
	children: React.ReactNode;
	className?: string;
};

export function AdminPageShell({ children, className }: AdminPageShellProps) {
	return (
		<main className={cn("min-h-[calc(100vh-52px)] w-full max-w-7xl mx-auto p-4 pb-8", className)}>{children}</main>
	);
}
