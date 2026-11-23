"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Disabled controls go quiet instead of changing colour (DESIGN.md §Disabled):
 * filled variants become "bg-muted text-muted-foreground", the rest keep their
 * surface and only mute the text. A busy (loading) or success-flash button keeps
 * its colour so feedback stays readable. Class names are written out in full so
 * Tailwind's scanner sees them.
 */

/**
 * Below "md" every size reaches a 44×44 hit area (DESIGN.md §Touch). Sizes that are
 * visually smaller than 44px get an invisible centred hit box through "::after".
 */
const touchHitArea =
	"max-md:after:absolute max-md:after:top-1/2 max-md:after:left-1/2 max-md:after:h-11 max-md:after:w-[max(100%,2.75rem)] max-md:after:-translate-x-1/2 max-md:after:-translate-y-1/2";

const buttonVariants = cva(
	"relative focus-ring aria-invalid:ring-destructive/20 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-transparent bg-clip-padding text-sm font-semibold aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed aria-disabled:pointer-events-none [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 group/button select-none disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:text-muted-foreground",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90 [a]:hover:bg-primary/90 disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:bg-muted",
				outline:
					"border-border bg-card hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:bg-card",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent aria-expanded:text-secondary-foreground disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:bg-muted",
				ghost:
					"hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
				destructive:
					"bg-destructive/10 hover:bg-destructive/15 dark:bg-destructive/20 text-destructive dark:hover:bg-destructive/30 disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:bg-muted",
				"destructive-ghost": "text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20",
				/** Solid destructive: only the confirm action of a `ConfirmSheet`. */
				"destructive-solid":
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:not-aria-busy:not-data-[feedback=success]:not-data-[feedback=error]:bg-muted",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default:
					"h-11 gap-1.5 px-4 text-base md:h-9 md:px-3 md:text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
				xs: `h-7 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs md:h-6 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3 ${touchHitArea}`,
				sm: `h-9 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm md:h-8 md:px-2.5 md:text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4 md:[&_svg:not([class*='size-'])]:size-3.5 ${touchHitArea}`,
				lg: "h-12 gap-2 px-5 text-base md:h-10 md:px-4 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
				icon: "size-11 md:size-9 [&_svg:not([class*='size-'])]:size-5 md:[&_svg:not([class*='size-'])]:size-4",
				"icon-xs": `size-7 md:size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5 md:[&_svg:not([class*='size-'])]:size-3 ${touchHitArea}`,
				"icon-sm": `size-9 md:size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg ${touchHitArea}`,
				"icon-lg": "size-11 md:size-10 [&_svg:not([class*='size-'])]:size-5",
				/** 44×44 at every width. App-bar actions, steppers, row actions. */
				"icon-touch": "size-11 [&_svg:not([class*='size-'])]:size-5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants> & {
		render?: React.ReactElement<{ className?: string }>;
	};

function Button({ className, variant = "default", size = "default", type = "button", render, ...props }: ButtonProps) {
	const mergedClassName = cn(buttonVariants({ variant, size, className }), render?.props.className);

	if (render) {
		return React.cloneElement(render, {
			...props,
			className: mergedClassName,
		});
	}

	return <button type={type} data-slot="button" className={mergedClassName} {...props} />;
}

export { Button, buttonVariants };
