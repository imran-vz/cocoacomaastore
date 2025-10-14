"use client";

export default function ManagerLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-[calc(100vh-52px)] flex-col">{children}</div>
	);
}
