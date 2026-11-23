import { cn } from "@/lib/utils";

/**
 * Page frames (DESIGN.md §Layout). Two content widths, one rule:
 *
 * - `narrow` (max-w-3xl): lists and forms — Catalog, Stock, Settings, Managers, UPI accounts.
 * - `wide` (max-w-7xl): data — Sell, Orders, Insights.
 *
 * Both are left-aligned to the page title's edge; a frame is never centred inside the admin
 * inset. The manager shell has no sidebar, so its pages pass `centered`: the frame then sits
 * in a centred 7xl column that lines up with the manager top bar, and narrow content stays
 * left-aligned inside it. Gutters: 16px on phones, 24px from md. `min-h-app` fills the space
 * between the bars, so short pages never scroll.
 */
export type PageFrameProps = {
	children: React.ReactNode;
	frame?: "narrow" | "wide";
	/** Manager pages: centre the 7xl column under the manager top bar. */
	centered?: boolean;
	/** Render as `<main>` when the layout doesn't already provide the landmark (manager). */
	as?: "div" | "main";
	className?: string;
};

export function PageFrame({ children, frame = "wide", centered = false, as: Tag = "div", className }: PageFrameProps) {
	return (
		<Tag
			data-slot="page-frame"
			data-frame={frame}
			className={cn("min-h-app w-full p-4 pb-8 md:p-6", centered && "mx-auto max-w-[83rem]", className)}
		>
			<div className={cn("w-full min-w-0", frame === "narrow" ? "max-w-3xl" : "max-w-7xl")}>{children}</div>
		</Tag>
	);
}
