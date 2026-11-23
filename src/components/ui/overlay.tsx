"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FocusTrap } from "@/components/ui/use-modal-focus";
import { cn } from "@/lib/utils";

/**
 * Every modal overlay (DESIGN.md §Overlays) is built from these parts: `OverlayRoot`, then
 * `OverlayContent` (scrim, focus trap, popup in one of two shapes, grabber), then an
 * `OverlayHeader` or an `OverlayTitle`. `FormSheet`, `ConfirmSheet`, the More sheet and the date
 * picker compose them; the hand-built POS cart sheet reuses the scrim, surface and grabber.
 */

export const scrimClassName = "bg-foreground/30 supports-backdrop-filter:backdrop-blur-[2px]";

export const sheetSurfaceClassName = "rounded-t-2xl bg-card text-card-foreground shadow-xl";

const SHAPES = {
	/** Bottom sheet below md, centred dialog from md: forms and confirmations. */
	responsive:
		"max-md:inset-x-0 max-md:bottom-0 max-md:rounded-t-2xl max-md:transition-transform max-md:duration-sheet max-md:ease-drawer max-md:data-starting-style:translate-y-full max-md:data-ending-style:translate-y-full md:top-1/2 md:left-1/2 md:w-[calc(100%-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:ring-1 md:ring-foreground/10 md:transition-[opacity,scale] md:duration-fast md:data-starting-style:scale-95 md:data-starting-style:opacity-0 md:data-ending-style:scale-95 md:data-ending-style:opacity-0",
	/** Bottom sheet at every width, for overlays that only open on phones. */
	sheet:
		"inset-x-0 bottom-0 rounded-t-2xl transition-transform duration-sheet ease-drawer data-starting-style:translate-y-full data-ending-style:translate-y-full",
} as const;

/** `alert`: a confirmation, which a scrim tap doesn't dismiss. */
export function OverlayRoot({
	alert = false,
	open,
	onOpenChange,
	children,
}: {
	alert?: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
}) {
	const Root = alert ? AlertDialog.Root : Dialog.Root;
	return (
		<Root open={open} onOpenChange={(next) => onOpenChange(next)}>
			{children}
		</Root>
	);
}

/**
 * Scrim, focus trap and the popup. Base UI hides the page from assistive tech and handles
 * Escape and focus return, but its focus guards let Tab walk out to the page, hence `FocusTrap`.
 */
export function OverlayContent({
	shape = "responsive",
	className,
	children,
	...props
}: Omit<Dialog.Popup.Props, "className" | "ref"> & {
	shape?: keyof typeof SHAPES;
	className?: string;
}) {
	const popupRef = React.useRef<HTMLDivElement>(null);
	return (
		<Dialog.Portal>
			{/* forceRender: an overlay opened over another (discard over its form) still dims the one behind. */}
			<Dialog.Backdrop
				forceRender
				className={cn(
					"fixed inset-0 z-overlay transition-opacity duration-enter data-starting-style:opacity-0 data-ending-style:opacity-0",
					scrimClassName,
				)}
			/>
			<FocusTrap containerRef={popupRef} />
			<Dialog.Popup
				ref={popupRef}
				className={cn(
					"fixed z-overlay flex flex-col bg-card text-card-foreground shadow-xl outline-none",
					SHAPES[shape],
					className,
				)}
				{...props}
			>
				<SheetGrabber className={shape === "responsive" ? "md:hidden" : undefined} />
				{children}
			</Dialog.Popup>
		</Dialog.Portal>
	);
}

/** The handle at the top of a bottom sheet (visual only). */
export function SheetGrabber({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn("mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25", className)}
		/>
	);
}

export function OverlayTitle({ className, ...props }: Dialog.Title.Props) {
	return <Dialog.Title className={cn("text-sheet-title text-foreground text-balance", className)} {...props} />;
}

export function OverlayDescription({ className, ...props }: Dialog.Description.Props) {
	return (
		<Dialog.Description
			className={cn("text-[15px] leading-snug text-muted-foreground text-pretty md:text-sm", className)}
			{...props}
		/>
	);
}

export const OverlayClose = Dialog.Close;

/**
 * The title row. With `actions` (a form's ⋯ and Save) it reads `✕ · Title · actions`, so the
 * primary action is always in the same place; without, `Title · ✕`.
 */
export function OverlayHeader({
	title,
	actions,
	closeDisabled,
	className,
}: {
	title: React.ReactNode;
	actions?: React.ReactNode;
	closeDisabled?: boolean;
	className?: string;
}) {
	const close = (
		<OverlayClose disabled={closeDisabled} render={<Button variant="ghost" size="icon-touch" aria-label="Close" />}>
			<X />
		</OverlayClose>
	);
	return (
		<header className={cn("flex min-h-14 shrink-0 items-center gap-1 px-2 md:px-3", className)}>
			{actions ? close : null}
			<OverlayTitle className={cn("min-w-0 flex-1 truncate", actions ? "px-1" : "px-2")}>{title}</OverlayTitle>
			{actions ? <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div> : close}
		</header>
	);
}
