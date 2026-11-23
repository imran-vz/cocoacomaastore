import type * as React from "react";

import { cn } from "@/lib/utils";

/** 16px text on phones (no iOS zoom), opaque card surface. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"text-foreground border-input placeholder:text-muted-foreground focus-ring focus-visible:border-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive aria-invalid:ring-3 bg-card flex field-sizing-content min-h-20 w-full rounded-lg border px-3 py-2.5 text-base transition-[color,border-color,box-shadow] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:min-h-16 md:py-2 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
