import type * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Dirty-state save bar (DESIGN.md §Save bar): the change summary, "Discard" and the form's
 * own save control (`children`, usually a `ReactiveButton`). Place it as the last child of
 * the page.
 */
export function SaveBar({
	open,
	message,
	onDiscard,
	busy = false,
	children,
}: {
	/** The form is dirty or its save is still giving feedback. */
	open: boolean;
	/** "3 changes", "Stock saved". */
	message: React.ReactNode;
	onDiscard?: () => void;
	/** A save is running: Discard waits for it. */
	busy?: boolean;
	children: React.ReactNode;
}) {
	if (!open) return null;

	return (
		<>
			{/* Keeps the last rows of the page scrollable above the fixed bar on phones. */}
			<div aria-hidden="true" className="h-20 md:hidden" />
			<section
				aria-label="Unsaved changes"
				data-slot="save-bar"
				className="z-bar animate-in fade-in-0 slide-in-from-bottom-2 duration-enter max-md:fixed max-md:inset-x-0 max-md:bottom-above-nav max-md:border-t max-md:bg-card max-md:px-4 max-md:pt-3 max-md:pb-safe-above-nav max-md:shadow-[0_-4px_16px_-8px] max-md:shadow-foreground/20 md:sticky md:bottom-4 md:mt-4 md:surface-card md:px-4 md:py-3 md:shadow-lg"
			>
				<div className="mx-auto flex max-w-3xl items-center gap-3">
					<p aria-live="polite" className="min-w-0 flex-1 truncate text-row text-foreground tabular-nums">
						{message}
					</p>
					{onDiscard ? (
						<Button variant="ghost" onClick={onDiscard} disabled={busy}>
							Discard
						</Button>
					) : null}
					{children}
				</div>
			</section>
		</>
	);
}
