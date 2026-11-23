"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { popupPositionerClassName, popupSurfaceClassName } from "@/components/ui/popup";
import { cn } from "@/lib/utils";

function DropdownMenu(props: MenuPrimitive.Root.Props) {
	return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
	return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/** The `⋯` button that opens a menu of secondary or destructive actions. */
function MoreMenuTrigger({
	label,
	size = "icon-touch",
	disabled,
	className,
}: {
	/** Accessible name: "More actions", "More moves for Brownie". */
	label: string;
	/** `icon`: 44px on phones, 36px from md (page headers). */
	size?: "icon" | "icon-touch";
	disabled?: boolean;
	className?: string;
}) {
	return (
		<DropdownMenuTrigger
			render={<Button variant="ghost" size={size} aria-label={label} disabled={disabled} className={className} />}
		>
			<MoreHorizontal />
		</DropdownMenuTrigger>
	);
}

function DropdownMenuContent({
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	className,
	...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<MenuPrimitive.Portal>
			<MenuPrimitive.Positioner
				className={popupPositionerClassName}
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<MenuPrimitive.Popup
					data-slot="dropdown-menu-content"
					className={cn(
						popupSurfaceClassName,
						"min-w-32 rounded-lg p-1 max-h-(--available-height) w-(--anchor-width) overflow-x-hidden overflow-y-auto data-closed:overflow-hidden",
						className,
					)}
					{...props}
				/>
			</MenuPrimitive.Positioner>
		</MenuPrimitive.Portal>
	);
}

function DropdownMenuItem({
	className,
	variant = "default",
	...props
}: MenuPrimitive.Item.Props & { variant?: "default" | "destructive" }) {
	return (
		<MenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-variant={variant}
			className={cn(
				"focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive not-data-[variant=destructive]:focus:**:text-accent-foreground gap-2 rounded-md min-h-11 px-2.5 py-2 text-base md:min-h-8 md:gap-1.5 md:px-1.5 md:py-1 md:text-sm [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
	return (
		<MenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn("bg-border -mx-1 my-1 h-px", className)}
			{...props}
		/>
	);
}

export {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	MoreMenuTrigger,
};
