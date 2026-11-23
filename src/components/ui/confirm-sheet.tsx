"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Loader2Icon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FocusTrap } from "@/components/ui/use-modal-focus";
import { cn } from "@/lib/utils";

/**
 * The one destructive confirmation (DESIGN.md §Confirmations). A bottom sheet over a scrim
 * below md, a centred alert dialog from md. Title as a question ("Delete Council Manager?"),
 * one muted line of consequence, an optional slot (e.g. a cancel reason), then a full-width
 * solid destructive confirm (48px on phones) and a ghost safe action. Focus starts on the safe
 * action, is trapped while open, and returns to the trigger on close.
 *
 * Use it only for actions that destroy or hide stored data. Never `window.confirm`.
 *
 * Controlled:
 * ```tsx
 * <ConfirmSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   title={`Delete ${manager.name}?`}
 *   description="They can't sign in any more. Their past orders stay."
 *   confirmLabel="Delete manager"
 *   pendingLabel="Deleting…"
 *   onConfirm={async () => { await deleteManager(manager.id); }}
 * />
 * ```
 * `onConfirm` may return a promise: the sheet stays open with a busy confirm button until it
 * settles, then closes. Return `false` (or throw) to keep it open; a thrown `Error` shows its
 * message in the sheet.
 *
 * Imperative (drop-in for an `if (!confirm(...)) return;` guard): see `useConfirmSheet`.
 */

/** Surface classes shared with `FormSheet`: bottom sheet below md, centred dialog from md. */
export const responsiveBackdropClassName =
	"fixed inset-0 z-50 bg-foreground/30 supports-backdrop-filter:backdrop-blur-[2px] transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0";

export const responsivePopupClassName =
	"fixed z-50 flex flex-col bg-card text-card-foreground outline-none shadow-xl " +
	// Phones: bottom sheet
	"max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:transition-transform max-md:duration-300 max-md:ease-drawer max-md:data-starting-style:translate-y-full max-md:data-ending-style:translate-y-full " +
	// md+: centred dialog
	"md:top-1/2 md:left-1/2 md:w-[calc(100%-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10 md:transition-[opacity,scale] md:duration-150 md:data-starting-style:scale-95 md:data-starting-style:opacity-0 md:data-ending-style:scale-95 md:data-ending-style:opacity-0";

/** Grabber shown on phone sheets (visual only). */
export function SheetGrabber() {
	return <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25 md:hidden" />;
}

export type ConfirmSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** A question naming the thing: "Delete Council Manager?", "Cancel order #5008?". */
	title: React.ReactNode;
	/** One muted line on the consequence. */
	description?: React.ReactNode;
	/** Verb + noun: "Delete manager", "Cancel order", "Hide all desserts", "Discard". */
	confirmLabel: React.ReactNode;
	/** Shown on the confirm button while `onConfirm` is pending. Defaults to `confirmLabel`. */
	pendingLabel?: React.ReactNode;
	/** The safe action. Defaults to "Cancel"; prefer "Keep order" where "Cancel" is ambiguous. */
	cancelLabel?: React.ReactNode;
	/** `destructive` (default) for deletes/hides/cancels; `default` for a non-destructive confirm. */
	tone?: "destructive" | "default";
	onConfirm: () => unknown | Promise<unknown>;
	/** Keeps the confirm button disabled (e.g. until a reason is picked). */
	confirmDisabled?: boolean;
	/** Optional slot between the description and the buttons (cancel reason, list of affected items). */
	children?: React.ReactNode;
	/** Element to focus on close when the trigger is gone. Defaults to the trigger / previous focus. */
	finalFocus?: AlertDialogPrimitive.Popup.Props["finalFocus"];
};

export function ConfirmSheet({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	pendingLabel,
	cancelLabel = "Cancel",
	tone = "destructive",
	onConfirm,
	confirmDisabled = false,
	children,
	finalFocus,
}: ConfirmSheetProps) {
	const cancelRef = React.useRef<HTMLButtonElement>(null);
	const popupRef = React.useRef<HTMLDivElement>(null);
	const [pending, setPending] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (open) setError(null);
	}, [open]);

	const handleConfirm = async () => {
		setError(null);
		setPending(true);
		try {
			const result = await onConfirm();
			if (result !== false) onOpenChange(false);
		} catch (cause) {
			setError(cause instanceof Error && cause.message ? cause.message : "Something went wrong. Try again.");
		} finally {
			setPending(false);
		}
	};

	return (
		<AlertDialogPrimitive.Root
			open={open}
			onOpenChange={(next) => {
				if (pending && !next) return;
				onOpenChange(next);
			}}
		>
			<AlertDialogPrimitive.Portal>
				{/* forceRender: a confirmation opened over a FormSheet still dims the form behind it. */}
				<AlertDialogPrimitive.Backdrop
					forceRender
					data-slot="confirm-sheet-overlay"
					className={responsiveBackdropClassName}
				/>
				<FocusTrap containerRef={popupRef} />
				<AlertDialogPrimitive.Popup
					ref={popupRef}
					data-slot="confirm-sheet"
					initialFocus={cancelRef}
					finalFocus={finalFocus}
					className={cn(responsivePopupClassName, "max-md:pb-[max(env(safe-area-inset-bottom),1rem)] md:max-w-md")}
				>
					<SheetGrabber />
					<div className="flex flex-col gap-1.5 px-4 pt-3 pb-4 md:px-6 md:pt-6">
						<AlertDialogPrimitive.Title className="text-[17px] leading-snug font-semibold text-foreground text-balance">
							{title}
						</AlertDialogPrimitive.Title>
						{description ? (
							<AlertDialogPrimitive.Description className="text-[15px] leading-snug text-muted-foreground text-pretty md:text-sm">
								{description}
							</AlertDialogPrimitive.Description>
						) : null}
					</div>
					{children ? <div className="px-4 pb-4 md:px-6">{children}</div> : null}
					{error ? (
						<p role="alert" className="px-4 pb-3 text-sm font-medium text-destructive md:px-6">
							{error}
						</p>
					) : null}
					<div className="flex flex-col gap-2 px-4 md:flex-row-reverse md:justify-start md:px-6 md:pb-6">
						<Button
							variant={tone === "destructive" ? "destructive-solid" : "default"}
							size="lg"
							className="w-full md:w-auto"
							disabled={confirmDisabled || pending}
							aria-busy={pending || undefined}
							onClick={handleConfirm}
						>
							{pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
							{pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
						</Button>
						<AlertDialogPrimitive.Close
							ref={cancelRef}
							disabled={pending}
							render={<Button variant="ghost" size="lg" className="w-full md:w-auto" />}
						>
							{cancelLabel}
						</AlertDialogPrimitive.Close>
					</div>
				</AlertDialogPrimitive.Popup>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
}

type AskOptions = Omit<ConfirmSheetProps, "open" | "onOpenChange" | "onConfirm" | "pendingLabel">;

/**
 * Imperative form for guards that used `window.confirm`:
 *
 * ```tsx
 * const confirmSheet = useConfirmSheet();
 * const onDelete = async () => {
 *   if (!(await confirmSheet.ask({ title: `Delete ${name}?`, description: "…", confirmLabel: "Delete UPI account" }))) return;
 *   deleteButton.setLoading();
 *   …
 * };
 * return <>{…}{confirmSheet.element}</>;
 * ```
 * `ask` resolves `true` when confirmed (the sheet closes at once) and `false` when dismissed.
 */
export function useConfirmSheet() {
	const [state, setState] = React.useState<(AskOptions & { open: boolean }) | null>(null);
	const resolver = React.useRef<((value: boolean) => void) | null>(null);

	const settle = React.useCallback((value: boolean) => {
		resolver.current?.(value);
		resolver.current = null;
		setState((previous) => (previous ? { ...previous, open: false } : previous));
	}, []);

	const ask = React.useCallback((options: AskOptions) => {
		resolver.current?.(false);
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve;
			setState({ ...options, open: true });
		});
	}, []);

	React.useEffect(() => () => resolver.current?.(false), []);

	const element = state ? (
		<ConfirmSheet
			{...state}
			open={state.open}
			onOpenChange={(open) => {
				if (!open) settle(false);
			}}
			onConfirm={() => settle(true)}
		/>
	) : null;

	return { ask, element };
}
