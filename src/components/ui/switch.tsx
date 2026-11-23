"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/** 24×40 on phones with a 44px hit area, 18×32 from md. Disabled goes quiet, not translucent. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			className={cn(
				"peer relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent transition-colors focus-ring touch-target md:h-[18.4px] md:w-8 data-checked:bg-primary data-unchecked:bg-input aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-disabled:cursor-not-allowed data-disabled:data-checked:bg-muted-foreground/40 data-disabled:data-unchecked:bg-input/60",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className="pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 md:size-4"
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
