import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Sizes and the quiet-disabled look follow DESIGN.md §Touch and §Disabled. A `busy` or
 * `feedback` button keeps its colour while disabled, so the feedback stays readable.
 */
const buttonVariants = cva(
	"relative focus-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive rounded-lg border border-transparent bg-clip-padding text-sm font-semibold aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,transform] motion-reduce:transition-none active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed aria-disabled:pointer-events-none [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 select-none",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				outline:
					"border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
				secondary: "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
				ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
				"destructive-ghost": "text-destructive hover:bg-destructive/10",
				/** Only the confirm action of a `ConfirmSheet`. */
				"destructive-solid": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
			},
			size: {
				default: "h-11 gap-1.5 px-4 text-base md:h-9 md:px-3 md:text-sm",
				sm: "touch-target h-9 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm md:h-8 md:px-2.5 md:text-[0.8rem] [&_svg:not([class*='size-'])]:size-4 md:[&_svg:not([class*='size-'])]:size-3.5",
				lg: "h-12 gap-2 px-5 text-base md:h-10 md:px-4",
				icon: "size-11 md:size-9 [&_svg:not([class*='size-'])]:size-5 md:[&_svg:not([class*='size-'])]:size-4",
				/** 44×44 at every width: app-bar actions, steppers, row actions. */
				"icon-touch": "size-11 [&_svg:not([class*='size-'])]:size-5",
			},
			quiet: { true: "text-muted-foreground", false: "" },
		},
		compoundVariants: [
			{ quiet: true, variant: ["default", "secondary", "destructive-solid"], className: "bg-muted" },
			{ quiet: true, variant: "outline", className: "bg-card" },
		],
		defaultVariants: { variant: "default", size: "default", quiet: false },
	},
);

type ButtonVariant = NonNullable<Parameters<typeof buttonVariants>[0]>["variant"];

type ButtonFeedback = "success" | "error";

/**
 * The success / error tint. Success is a primary tint on the primary button and a success
 * tint on every other host, so a quiet button never flashes brand colour.
 */
export function buttonFeedbackClass(feedback: ButtonFeedback | undefined, tone: "brand" | "neutral") {
	if (feedback === "error") return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/10";
	if (feedback !== "success") return "";
	return tone === "brand"
		? "border-primary/30 bg-primary/15 text-primary hover:bg-primary/20"
		: "border-success/30 bg-success/10 text-success hover:bg-success/10";
}

export type ButtonProps = React.ComponentProps<"button"> & {
	variant?: ButtonVariant;
	size?: "default" | "sm" | "lg" | "icon" | "icon-touch";
	/** An action is running: sets `aria-busy` and keeps the colour while disabled. */
	busy?: boolean;
	/** A success or error flash. */
	feedback?: ButtonFeedback;
	/** Renders this element (e.g. a `Link`) with the button's look instead of a `<button>`. */
	render?: React.ReactElement<{ className?: string }>;
};

function Button({
	className,
	variant = "default",
	size = "default",
	type = "button",
	busy = false,
	feedback,
	render,
	...props
}: ButtonProps) {
	const quiet = Boolean(props.disabled) && !busy && !feedback;
	const mergedClassName = cn(
		buttonVariants({ variant, size, quiet }),
		buttonFeedbackClass(feedback, variant === "default" ? "brand" : "neutral"),
		className,
		render?.props.className,
	);
	const shared = { ...props, "aria-busy": busy || undefined, className: mergedClassName };

	if (render) return React.cloneElement(render, shared);
	return <button type={type} data-slot="button" {...shared} />;
}

export { Button };
