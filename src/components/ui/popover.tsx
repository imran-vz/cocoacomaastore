"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useRef } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Clicking the open trigger while the popup is open fires outside-press (close)
 * then trigger-press (open) in the same gesture.
 *
 * In controlled mode the store closes on outside-press while React's `open` prop
 * is still true until the next paint — controlled sync can reopen, then the
 * pending setState(false) closes again (flicker). flushSync the close, and
 * cancel + re-assert false if a reopen still sneaks through.
 */
const TRIGGER_REOPEN_GUARD_MS = 400;

function Popover({ onOpenChange, ...props }: PopoverPrimitive.Root.Props) {
	const skipOpenUntilRef = useRef(0);

	return (
		<PopoverPrimitive.Root
			data-slot="popover"
			{...props}
			onOpenChange={(nextOpen, eventDetails) => {
				if (!nextOpen) {
					if (eventDetails.reason === "outside-press" || eventDetails.reason === "focus-out") {
						skipOpenUntilRef.current = performance.now() + TRIGGER_REOPEN_GUARD_MS;
					}
					if (onOpenChange) {
						flushSync(() => {
							onOpenChange(nextOpen, eventDetails);
						});
					}
					return;
				}

				if (performance.now() < skipOpenUntilRef.current) {
					eventDetails.cancel();
					if (onOpenChange) {
						flushSync(() => {
							onOpenChange(false, eventDetails);
						});
					}
					return;
				}

				onOpenChange?.(nextOpen, eventDetails);
			}}
		/>
	);
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
	return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
	align = "center",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 8,
	collisionPadding = 12,
	collisionAvoidance = {
		side: "flip",
		align: "shift",
		fallbackAxisSide: "none",
	},
	className,
	...props
}: PopoverPrimitive.Popup.Props &
	Pick<
		PopoverPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding" | "collisionAvoidance"
	>) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				className="isolate z-50 outline-none"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				collisionAvoidance={collisionAvoidance}
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					className={cn(
						"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground z-50 w-72 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-xl p-4 text-sm shadow-md ring-1 duration-100 outline-none motion-reduce:animate-none motion-reduce:transition-none",
						className,
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
	return (
		<PopoverPrimitive.Title
			data-slot="popover-title"
			className={cn("text-base leading-none font-medium", className)}
			{...props}
		/>
	);
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
	return (
		<PopoverPrimitive.Description
			data-slot="popover-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger };
