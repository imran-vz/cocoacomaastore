import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badges are neutral by default; colour means status (DESIGN.md §Badges).
 * Routine states (Completed, Enabled, a role) get no badge at all — render them
 * as muted text. Use `destructive` / `warning` / `success` / `info` only for an
 * exception the reader must notice (Cancelled, Disabled, Out of stock, Low).
 */
const badgeVariants = cva(
	"h-5 gap-1 rounded-full border border-transparent px-2 text-xs font-semibold tabular-nums transition-colors has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:size-3! inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none focus-ring aria-invalid:border-destructive overflow-hidden group/badge",
	{
		variants: {
			variant: {
				/** Neutral: counts, "Combo", "Hidden". */
				default: "bg-muted text-muted-foreground [a]:hover:bg-accent",
				/** Alias of `default`, kept for existing call sites. */
				secondary: "bg-muted text-muted-foreground [a]:hover:bg-accent",
				outline: "border-border bg-card text-muted-foreground [a]:hover:bg-muted",
				/** Brand tint for a selected/featured state — not for routine status. */
				brand: "bg-primary/10 text-primary [a]:hover:bg-primary/15",
				success: "bg-success/12 text-success",
				warning: "bg-warning/12 text-warning",
				info: "bg-info/12 text-info",
				destructive: "bg-destructive/10 text-destructive [a]:hover:bg-destructive/15 dark:bg-destructive/20",
				ghost: "text-muted-foreground hover:bg-muted",
				link: "text-primary underline-offset-4 hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

/** Neutral by default; pass a status variant only for exceptions. */
function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props,
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
