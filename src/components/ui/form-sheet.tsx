"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { IconDots, IconX } from "@tabler/icons-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
	ConfirmSheet,
	responsiveBackdropClassName,
	responsivePopupClassName,
	SheetGrabber,
} from "@/components/ui/confirm-sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FocusTrap } from "@/components/ui/use-modal-focus";
import { cn } from "@/lib/utils";

/**
 * The one container for add/edit forms (DESIGN.md §Forms). A full-height bottom sheet below
 * md, a centred dialog from md, with the same header at every width:
 *
 *   ✕ · Title ·········· [⋯] [Save]
 *
 * - The primary action sits in the header, so it is always in the same place and stays
 *   visible above the phone keyboard. It is disabled until the form is `dirty`.
 * - Closing a dirty form (✕, Escape, scrim) asks "Discard changes?" through `ConfirmSheet`.
 *   Closing after a successful save is the caller's own `onOpenChange(false)`, so it never asks.
 * - Destructive actions (Delete dessert / Delete combo) live behind the `⋯` (`menu`), each
 *   opening its own `ConfirmSheet`; they never sit next to Save.
 * - Focus: the first field on open (keyboard/mouse; touch focuses the sheet so the keyboard
 *   doesn't pop), trapped while open, back to the trigger on close.
 *
 * ```tsx
 * const formId = "dessert-form";
 * <FormSheet
 *   open={open}
 *   onOpenChange={setOpen}
 *   title={editing ? "Edit dessert" : "Add dessert"}
 *   dirty={isDirty}
 *   busy={saveButton.isBusy}
 *   primary={<SubmitButton type="submit" form={formId} size="sm" />}
 *   menu={editing ? <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>Delete dessert</DropdownMenuItem> : null}
 * >
 *   <form id={formId} onSubmit={handleSubmit} className="space-y-4">…</form>
 * </FormSheet>
 * ```
 */
export type FormSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	/** One muted line under the header ("They sign in with this email and password."). */
	description?: React.ReactNode;
	/** True when any field differs from its initial value. Drives the primary state and the discard prompt. */
	dirty: boolean;
	/** True while saving: blocks closing and keeps the primary enabled for its busy state. */
	busy?: boolean;
	/**
	 * The primary action, usually a submit button tied to the form by `form={formId}`.
	 * FormSheet disables it while the form is clean; its own `disabled` adds to that.
	 * Use `size="sm"` so it fits the header.
	 */
	primary: React.ReactElement<{ disabled?: boolean }>;
	/** `DropdownMenuItem`s for the `⋯` menu (destructive actions). Omit for no menu. */
	menu?: React.ReactNode;
	/** Discard prompt copy. */
	discardTitle?: React.ReactNode;
	discardDescription?: React.ReactNode;
	children: React.ReactNode;
	/** Extra classes for the scrolling body. */
	bodyClassName?: string;
	/** Focus target on close when the trigger is gone. */
	finalFocus?: DialogPrimitive.Popup.Props["finalFocus"];
};

const FIELD_SELECTOR =
	'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="combobox"]:not([aria-disabled="true"])';

export function FormSheet({
	open,
	onOpenChange,
	title,
	description,
	dirty,
	busy = false,
	primary,
	menu,
	discardTitle = "Discard changes?",
	discardDescription = "Your changes won't be saved.",
	children,
	bodyClassName,
	finalFocus,
}: FormSheetProps) {
	const bodyRef = React.useRef<HTMLDivElement>(null);
	const popupRef = React.useRef<HTMLDivElement>(null);
	const [confirmDiscard, setConfirmDiscard] = React.useState(false);

	React.useEffect(() => {
		if (!open) setConfirmDiscard(false);
	}, [open]);

	const requestClose = () => {
		if (busy) return;
		if (dirty) {
			setConfirmDiscard(true);
			return;
		}
		onOpenChange(false);
	};

	const primaryElement = React.cloneElement(primary, {
		disabled: Boolean(primary.props.disabled) || (!dirty && !busy),
	});

	return (
		<DialogPrimitive.Root
			open={open}
			onOpenChange={(next) => {
				if (next) onOpenChange(true);
				else requestClose();
			}}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop data-slot="form-sheet-overlay" className={responsiveBackdropClassName} />
				<FocusTrap containerRef={popupRef} />
				<DialogPrimitive.Popup
					ref={popupRef}
					data-slot="form-sheet"
					initialFocus={(type) => {
						if (type === "touch") return true;
						return bodyRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? true;
					}}
					finalFocus={finalFocus}
					className={cn(
						responsivePopupClassName,
						"max-md:top-[calc(env(safe-area-inset-top)+0.75rem)] md:max-h-[calc(100dvh-4rem)] md:max-w-lg",
					)}
				>
					<SheetGrabber />
					<header className="flex h-14 shrink-0 items-center gap-1 border-b px-2 md:px-3">
						<Button variant="ghost" size="icon-touch" aria-label="Close" onClick={requestClose} disabled={busy}>
							<IconX />
						</Button>
						<DialogPrimitive.Title className="min-w-0 flex-1 truncate px-1 text-[17px] font-semibold text-foreground md:text-base">
							{title}
						</DialogPrimitive.Title>
						{menu ? (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button variant="ghost" size="icon-touch" aria-label="More actions" disabled={busy}>
											<IconDots />
										</Button>
									}
								/>
								<DropdownMenuContent align="end" className="min-w-52">
									{menu}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
						<div className="flex shrink-0 items-center pr-1 pl-1">{primaryElement}</div>
					</header>
					<div
						ref={bodyRef}
						className={cn(
							"min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] md:px-6 md:pb-6",
							bodyClassName,
						)}
					>
						{description ? (
							<DialogPrimitive.Description className="mb-4 text-sm text-muted-foreground text-pretty">
								{description}
							</DialogPrimitive.Description>
						) : null}
						{children}
					</div>
				</DialogPrimitive.Popup>
			</DialogPrimitive.Portal>
			<ConfirmSheet
				open={confirmDiscard}
				onOpenChange={setConfirmDiscard}
				title={discardTitle}
				description={discardDescription}
				confirmLabel="Discard"
				cancelLabel="Keep editing"
				onConfirm={() => {
					setConfirmDiscard(false);
					onOpenChange(false);
				}}
			/>
		</DialogPrimitive.Root>
	);
}
