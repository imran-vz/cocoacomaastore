"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/** 24×40 on phones (44px hit area), 18×32 from md. Disabled goes quiet, not translucent. */
function Switch({
	className,
	size = "default",
	...props
}: SwitchPrimitive.Root.Props & {
	size?: "sm" | "default";
}) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				"data-checked:bg-primary data-unchecked:bg-input focus-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-full border border-transparent aria-invalid:ring-3 data-[size=default]:h-6 data-[size=default]:w-10 md:data-[size=default]:h-[18.4px] md:data-[size=default]:w-8 data-[size=sm]:h-5 data-[size=sm]:w-8 md:data-[size=sm]:h-3.5 md:data-[size=sm]:w-6 peer group/switch relative inline-flex items-center transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 md:after:-inset-x-3 md:after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:data-checked:bg-muted-foreground/40 data-disabled:data-unchecked:bg-input/60",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full group-data-[size=default]/switch:size-5 md:group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-4 md:group-data-[size=sm]/switch:size-3 shadow-sm group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block ring-0 transition-transform"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
