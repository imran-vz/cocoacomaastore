"use client";

import type * as React from "react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Dirty-state save bar (DESIGN.md §Save bar). Renders only while a form has unsaved
 * changes: "3 changes" + "Discard" + the primary save action.
 *
 * - Phones: fixed to the bottom, directly above the bottom tab bar
 *   (`--bottom-nav-height`, published by the shell) and safe-area aware.
 * - md and up: sticky at the bottom of the content column as a floating card, so it
 *   never covers the admin sidebar. Place it as the last child of the form/page.
 *
 * It only moves the existing save trigger; pass the page's existing save handler, or your
 * own `ReactiveButton` through `saveButton` to keep loading/success feedback.
 */
export type SaveBarProps = {
	/** Show the bar (the form is dirty). */
	open: boolean;
	/** Number of changed records; renders "1 change" / "3 changes". */
	changes?: number;
	/** Replaces the default change count text. */
	message?: React.ReactNode;
	onDiscard?: () => void;
	discardLabel?: string;
	onSave?: () => void;
	/** Sentence case: "Save stock". */
	saveLabel?: string;
	saving?: boolean;
	saveDisabled?: boolean;
	/** Custom save control (e.g. a `ReactiveButton`); replaces `onSave`/`saveLabel`. */
	saveButton?: React.ReactNode;
	className?: string;
};

function SaveBar({
	open,
	changes,
	message,
	onDiscard,
	discardLabel = "Discard",
	onSave,
	saveLabel = "Save",
	saving = false,
	saveDisabled = false,
	saveButton,
	className,
}: SaveBarProps) {
	if (!open) return null;

	const text = message ?? (changes !== undefined ? formatCount(changes, "changes") : "Unsaved changes");

	return (
		<>
			{/* Keeps the last rows of the page scrollable above the fixed bar on phones. */}
			<div aria-hidden="true" className="h-20 md:hidden" />
			<section
				aria-label="Unsaved changes"
				data-slot="save-bar"
				className={cn(
					"z-30 animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
					"max-md:fixed max-md:inset-x-0 max-md:bottom-above-nav max-md:border-t max-md:bg-card max-md:px-4 max-md:pt-3 max-md:pb-safe-above-nav max-md:shadow-[0_-4px_16px_-8px_oklch(0.21_0.018_40/0.18)]",
					"md:sticky md:bottom-4 md:mt-4 md:rounded-xl md:border md:bg-card md:px-4 md:py-3 md:shadow-lg",
					className,
				)}
			>
				<div className="mx-auto flex max-w-3xl items-center gap-3">
					<p
						aria-live="polite"
						className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground tabular-nums"
					>
						{text}
					</p>
					{onDiscard ? (
						<Button variant="ghost" onClick={onDiscard} disabled={saving}>
							{discardLabel}
						</Button>
					) : null}
					{saveButton ?? (
						<Button onClick={onSave} disabled={saveDisabled || saving} aria-busy={saving || undefined}>
							{saveLabel}
						</Button>
					)}
				</div>
			</section>
		</>
	);
}

export { SaveBar };
