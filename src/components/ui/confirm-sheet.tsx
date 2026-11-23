"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { OverlayClose, OverlayContent, OverlayDescription, OverlayRoot, OverlayTitle } from "@/components/ui/overlay";
import { Spinner } from "@/components/ui/spinner";
import { ACTION_FAILED, type ActionResult } from "@/lib/action-result";

// biome-ignore lint/suspicious/noConfusingVoidType: a callback that returns nothing closes the sheet
type ConfirmOutcome = void | ActionResult<unknown>;

/** The one destructive confirmation (DESIGN.md §Confirmations). */
type ConfirmSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** A question naming the thing: "Delete Council Manager?". */
	title: React.ReactNode;
	/** One muted line on the consequence. */
	description?: React.ReactNode;
	/** Verb + noun: "Delete manager". */
	confirmLabel: React.ReactNode;
	/** Shown on the confirm button while `onConfirm` runs. */
	pendingLabel?: React.ReactNode;
	cancelLabel?: React.ReactNode;
	/**
	 * Runs on confirm; the confirm button stays busy until it settles, then the sheet closes. A failed
	 * `ActionResult` keeps the sheet open showing its `error`.
	 */
	onConfirm: () => ConfirmOutcome | Promise<ConfirmOutcome>;
	/** An input the action needs (a cancel reason), between the description and the buttons. */
	children?: React.ReactNode;
	/** Where focus goes on close when the trigger is gone. */
	finalFocus?: React.ComponentProps<typeof OverlayContent>["finalFocus"];
};

export function ConfirmSheet({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	pendingLabel,
	cancelLabel = "Cancel",
	onConfirm,
	children,
	finalFocus,
}: ConfirmSheetProps) {
	const cancelRef = React.useRef<HTMLButtonElement>(null);
	const [pending, setPending] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const handleOpenChange = (next: boolean) => {
		if (pending && !next) return;
		setError(null);
		onOpenChange(next);
	};

	const handleConfirm = async () => {
		setError(null);
		setPending(true);
		try {
			const outcome = await onConfirm();
			if (outcome && !outcome.ok) setError(outcome.error);
			else onOpenChange(false);
		} catch (cause) {
			console.error(cause);
			setError(ACTION_FAILED);
		} finally {
			setPending(false);
		}
	};

	return (
		<OverlayRoot alert open={open} onOpenChange={handleOpenChange}>
			<OverlayContent initialFocus={cancelRef} finalFocus={finalFocus} className="max-md:pb-safe-4 md:max-w-md">
				<div className="flex flex-col gap-1.5 px-4 pt-3 pb-4 md:px-6 md:pt-6">
					<OverlayTitle>{title}</OverlayTitle>
					{description ? <OverlayDescription>{description}</OverlayDescription> : null}
				</div>
				{children ? <div className="px-4 pb-4 md:px-6">{children}</div> : null}
				{error ? (
					<p role="alert" className="px-4 pb-3 text-sm font-medium text-destructive md:px-6">
						{error}
					</p>
				) : null}
				<div className="flex flex-col gap-2 px-4 md:flex-row-reverse md:justify-start md:px-6 md:pb-6">
					<Button
						variant="destructive-solid"
						size="lg"
						className="w-full md:w-auto"
						disabled={pending}
						busy={pending}
						onClick={handleConfirm}
					>
						{pending ? <Spinner /> : null}
						{pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
					</Button>
					<OverlayClose
						ref={cancelRef}
						disabled={pending}
						render={<Button variant="ghost" size="lg" className="w-full md:w-auto" />}
					>
						{cancelLabel}
					</OverlayClose>
				</div>
			</OverlayContent>
		</OverlayRoot>
	);
}
