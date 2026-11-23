"use client";

import { usePathname } from "next/navigation";

import { type Frame, routeInfo } from "@/features/shell/routes";
import { cn } from "@/lib/utils";

/** Widths from globals.css, where `--shell-column` is derived from the wide frame. */
const FRAME_WIDTH: Record<Frame, string> = {
	narrow: "max-w-(--frame-narrow)",
	wide: "max-w-(--frame-wide)",
	// The wide frame plus its gutters, so a screen that draws its own gutters lines up with the rest.
	bleed: "max-w-(--shell-column)",
};

/**
 * The page landmark. Content sits in the route's frame (DESIGN.md §Layout): left-aligned
 * under the admin sidebar, in a centred column under the manager's top bar. Gutters are 16px
 * on phones and 24px from md; `min-h-app` fills the space between the bars.
 *
 * It is also the `@container/main` size container, so list↔table switches query the content
 * width, not the viewport, and the admin sidebar never clips a table.
 */
export function ShellMain({ centered, children }: { centered: boolean; children: React.ReactNode }) {
	const { frame } = routeInfo(usePathname());

	return (
		<main data-app-main className="@container/main relative flex min-w-0 flex-1 flex-col pb-(--bottom-nav-height)">
			<div
				data-frame={frame}
				className={cn(
					"min-h-app w-full",
					frame === "bleed" ? "p-0" : "p-4 pb-8 md:p-(--shell-gutter)",
					centered && "mx-auto max-w-(--shell-column)",
				)}
			>
				<div className={cn("w-full min-w-0", FRAME_WIDTH[frame])}>{children}</div>
			</div>
		</main>
	);
}
