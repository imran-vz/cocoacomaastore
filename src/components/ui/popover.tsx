"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { popupPositionerClassName, popupSurfaceClassName } from "@/components/ui/popup";
import { cn } from "@/lib/utils";

function Popover(props: PopoverPrimitive.Root.Props) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
	align = "center",
	className,
	...props
}: PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, "align">) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				className={popupPositionerClassName}
				align={align}
				side="bottom"
				sideOffset={8}
				collisionPadding={12}
				collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					className={cn(popupSurfaceClassName, "w-72 max-w-[calc(100vw-2rem)] rounded-xl p-4 text-sm", className)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverContent, PopoverTrigger };
