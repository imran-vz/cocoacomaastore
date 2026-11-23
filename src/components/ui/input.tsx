import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				// 44px tall with 16px text on phones (no iOS zoom); compact from md up.
				"text-foreground file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-card dark:bg-input/30 border-input h-11 w-full min-w-0 rounded-lg border px-3 py-1 text-base tabular-nums transition-[color,border-color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:h-9 md:text-sm",
				"disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground read-only:bg-muted/60",
				"focus-ring focus-visible:border-ring",
				"aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
