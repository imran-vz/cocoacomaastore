"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 20px box on phones (44px hit area), 16px from md. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
	return (
		<CheckboxPrimitive.Root
			data-slot="checkbox"
			className={cn(
				"border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 bg-card flex size-5 md:size-4 items-center justify-center rounded-[5px] md:rounded-[4px] border transition-colors group-has-disabled/field:opacity-50 aria-invalid:ring-3 peer relative shrink-0 after:absolute after:-inset-3 md:after:-inset-x-3 md:after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:bg-muted data-disabled:border-border data-disabled:text-muted-foreground",
				className,
			)}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				data-slot="checkbox-indicator"
				className="[&>svg]:size-4 md:[&>svg]:size-3.5 grid place-content-center text-current transition-none"
			>
				<CheckIcon />
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
}

export { Checkbox };
