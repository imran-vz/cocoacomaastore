"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";

import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, MoreMenuTrigger } from "@/components/ui/dropdown-menu";
import { FEEDBACK_MS } from "@/components/ui/feedback";
import { OverlayContent, OverlayDescription, OverlayHeader, OverlayRoot } from "@/components/ui/overlay";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { type ActionResult, useRunAction } from "@/lib/action-result";

const SAVE_FAILED = "Couldn't save. Try again.";

type Save = () => Promise<ActionResult<unknown>>;

type FormState = {
	/** True when any field differs from its initial value. */
	dirty: boolean;
	/** Saves the form. Runs once per submit; the sheet can't close until it settles. */
	onSave: Save;
};

const FormSheetContext = React.createContext<{
	setDirty: (dirty: boolean) => void;
	saveRef: React.RefObject<Save | null>;
} | null>(null);

/** Called by the fields inside a `FormSheet`: tells the sheet whether they changed and how to save them. */
export function useFormSheet({ dirty, onSave }: FormState) {
	const sheet = React.useContext(FormSheetContext);
	if (!sheet) throw new Error("useFormSheet is called from the fields inside a FormSheet");
	const { setDirty, saveRef } = sheet;
	React.useLayoutEffect(() => setDirty(dirty), [setDirty, dirty]);
	React.useLayoutEffect(() => {
		saveRef.current = onSave;
	});
}

/**
 * The one container for add/edit forms (DESIGN.md §Forms). Its children are the fields, a
 * component that keeps the form's values and calls `useFormSheet`; the sheet mounts them afresh on
 * every opening, so each opening starts from the saved values. It renders the `<form>` and runs
 * the save: `onSave` while the submit button shows "Saving…", then a failed result's `error`
 * flashed on the button, or, once the lists showing the change have refreshed, a success flash and
 * the sheet closing. `onDelete` adds a confirmed delete to the `⋯` menu.
 *
 * ```tsx
 * <FormSheet open={open} onOpenChange={setOpen} title="Edit dessert" submitLabel="Save" savedLabel="Updated"
 *   onDelete={() => deleteDessert(id)} deleteLabel="Delete dessert" deleteTitle="Delete Brownie?">
 *   <DessertFields dessert={dessert} />
 * </FormSheet>
 * ```
 */
type FormSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	/** One muted line above the fields. */
	description?: React.ReactNode;
	/** The submit button's label: "Save", "Add". */
	submitLabel: string;
	/** Flashed on the submit button once saved: "Updated", "Added". */
	savedLabel: string;
	/** Deletes the record once confirmed, then the sheet closes. */
	onDelete?: Save;
	/** Verb + noun, on the menu item and the confirm button: "Delete dessert". */
	deleteLabel?: string;
	/** The confirmation's question: "Delete Brownie?". */
	deleteTitle?: React.ReactNode;
	/** The confirmation's consequence line. */
	deleteDescription?: React.ReactNode;
	children: React.ReactNode;
};

const FIELD_SELECTOR =
	'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([aria-disabled="true"])';

export function FormSheet({
	open,
	onOpenChange,
	title,
	description,
	submitLabel,
	savedLabel,
	onDelete,
	deleteLabel = "Delete",
	deleteTitle,
	deleteDescription,
	children,
}: FormSheetProps) {
	const runAction = useRunAction();
	const formId = React.useId();
	const bodyRef = React.useRef<HTMLDivElement>(null);
	const saveRef = React.useRef<Save | null>(null);
	const [dirty, setDirty] = React.useState(false);
	const form = React.useMemo(() => ({ setDirty, saveRef }), []);
	const [controls, SubmitButton] = useReactiveButton({
		label: submitLabel,
		loading: { label: "Saving…" },
		success: { label: savedLabel, duration: FEEDBACK_MS.beforeClose },
	});
	const [confirm, setConfirm] = React.useState<"discard" | "delete" | null>(null);
	const [opening, setOpening] = React.useState(0);
	const [wasOpen, setWasOpen] = React.useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			setOpening(opening + 1);
			setDirty(false);
		} else {
			setConfirm(null);
		}
	}
	const busy = controls.isBusy;

	const close = () => {
		controls.reset();
		onOpenChange(false);
	};

	const requestClose = () => {
		if (busy) return;
		if (dirty) {
			setConfirm("discard");
			return;
		}
		close();
	};

	const save = async () => {
		const onSave = saveRef.current;
		if (!onSave || controls.status === "loading" || controls.status === "success") return;
		const token = controls.setLoading();
		const result = await runAction(onSave(), { fallback: SAVE_FAILED });
		if (!result.ok) {
			controls.setError(result.error, { token });
			return;
		}
		controls.setSuccess(undefined, { token, onComplete: () => onOpenChange(false) });
	};

	const remove = async () => {
		if (!onDelete) return;
		const result = await runAction(onDelete());
		if (!result.ok) return result;
		close();
	};

	const setConfirmOpen = (kind: "discard" | "delete") => (next: boolean) => setConfirm(next ? kind : null);

	return (
		<OverlayRoot
			open={open}
			onOpenChange={(next) => {
				if (next) onOpenChange(true);
				else requestClose();
			}}
		>
			<OverlayContent
				// A touch open focuses the sheet, not the first field, so the phone keyboard doesn't pop up.
				initialFocus={(type) => {
					if (type === "touch") return true;
					return bodyRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? true;
				}}
				className="max-md:top-[calc(env(safe-area-inset-top)+0.75rem)] md:max-h-[calc(100dvh-4rem)] md:max-w-lg"
			>
				<OverlayHeader
					title={title}
					closeDisabled={busy}
					className="border-b"
					actions={
						<>
							{onDelete ? (
								<DropdownMenu>
									<MoreMenuTrigger label="More actions" disabled={busy} />
									<DropdownMenuContent align="end" className="min-w-52">
										<DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
											<Trash2 aria-hidden="true" />
											{deleteLabel}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
							<SubmitButton type="submit" form={formId} size="sm" disabled={!dirty && !busy} />
						</>
					}
				/>
				<div
					ref={bodyRef}
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-safe-6 md:px-6 md:pb-6"
				>
					{description ? <OverlayDescription className="mb-4">{description}</OverlayDescription> : null}
					<form
						id={formId}
						onSubmit={(event) => {
							event.preventDefault();
							void save();
						}}
						className="space-y-4"
					>
						<FormSheetContext value={form}>
							<React.Fragment key={opening}>{children}</React.Fragment>
						</FormSheetContext>
					</form>
				</div>
			</OverlayContent>
			<ConfirmSheet
				open={confirm === "discard"}
				onOpenChange={setConfirmOpen("discard")}
				title="Discard changes?"
				description="Your changes won't be saved."
				confirmLabel="Discard"
				cancelLabel="Keep editing"
				onConfirm={close}
			/>
			{onDelete ? (
				<ConfirmSheet
					open={confirm === "delete"}
					onOpenChange={setConfirmOpen("delete")}
					title={deleteTitle ?? `${deleteLabel}?`}
					description={deleteDescription}
					confirmLabel={deleteLabel}
					pendingLabel="Deleting…"
					onConfirm={remove}
				/>
			) : null}
		</OverlayRoot>
	);
}
