"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { FocusTrap } from "@/components/ui/use-modal-focus";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	return (
		<SheetPrimitive.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-foreground/25 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Opaque card surface; the close button is 44px on phones. Modal: Base UI hides the page,
 * handles Escape and returns focus to the trigger; `FocusTrap` keeps Tab inside.
 */
function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	ref,
	...props
}: SheetPrimitive.Popup.Props & {
	side?: "top" | "right" | "bottom" | "left";
	showCloseButton?: boolean;
	ref?: React.Ref<HTMLDivElement>;
}) {
	const popupRef = React.useRef<HTMLDivElement>(null);
	return (
		<SheetPortal>
			<SheetOverlay />
			<FocusTrap containerRef={popupRef} />
			<SheetPrimitive.Popup
				ref={mergeRefs(popupRef, ref)}
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"bg-card text-card-foreground data-open:animate-in data-closed:animate-out data-[side=right]:data-closed:slide-out-to-right-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=top]:data-closed:slide-out-to-top-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:fade-out-0 data-open:fade-in-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=bottom]:data-open:slide-in-from-bottom-10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-drawer data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<SheetPrimitive.Close
						data-slot="sheet-close"
						render={
							<Button variant="ghost" className="absolute top-2 right-2 md:top-3 md:right-3" size="icon">
								<XIcon />
								<span className="sr-only">Close</span>
							</Button>
						}
					/>
				)}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
	return (value) => {
		for (const ref of refs) {
			if (typeof ref === "function") ref(value);
			else if (ref) (ref as React.RefObject<T | null>).current = value;
		}
	};
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="sheet-header" className={cn("gap-0.5 p-4 flex flex-col", className)} {...props} />;
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cn("text-foreground text-lg font-semibold md:text-base", className)}
			{...props}
		/>
	);
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription };
