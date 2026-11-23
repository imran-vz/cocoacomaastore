import Link from "next/link";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One page header for every screen (DESIGN.md §Page header).
 *
 * - Title: 22/700 on phones, 26/700 from md, sentence case, equal to the nav label.
 * - Description: one muted line (optional).
 * - Action: one primary action, right-aligned. Use `PageHeaderAction` so it is a 44px icon
 *   button on phones and a labeled button from md.
 * - `children`: one row under the title (segmented control, date switcher, search).
 *
 * The `<h1>` carries `data-app-title`, which the shell's app bar watches to show the
 * page title only once this heading scrolls away.
 */
export type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	/** The page's single primary action, usually a `PageHeaderAction`. */
	action?: React.ReactNode;
	/**
	 * `"inline"` (default): the action renders here at every width.
	 * `"desktop"`: hidden below md — use when the same action is registered in the mobile
	 * app bar (`<AppBar action={…} />`), so it renders once.
	 */
	actionPlacement?: "inline" | "desktop";
	/** Quiet secondary controls next to the action (e.g. a `⋯` overflow menu). */
	secondary?: React.ReactNode;
};

function PageHeader({
	title,
	description,
	action,
	actionPlacement = "inline",
	secondary,
	children,
	className,
	...props
}: PageHeaderProps) {
	return (
		<header data-slot="page-header" className={cn("flex flex-col gap-4 pb-4 md:pb-6", className)} {...props}>
			<div className="flex min-h-11 items-center gap-3">
				<div className="min-w-0 flex-1">
					<h1
						data-app-title
						className="text-[22px] leading-7 font-bold tracking-tight text-foreground text-balance md:text-[26px] md:leading-8"
					>
						{title}
					</h1>
					{description ? (
						<p className="mt-0.5 text-sm text-muted-foreground text-pretty tabular-nums">{description}</p>
					) : null}
				</div>
				{secondary || action ? (
					<div className="flex shrink-0 items-center gap-2">
						{secondary}
						{action ? (
							<div className={cn("flex items-center", actionPlacement === "desktop" && "max-md:hidden")}>{action}</div>
						) : null}
					</div>
				) : null}
			</div>
			{children}
		</header>
	);
}

type PageHeaderActionBase = {
	/** Icon component, e.g. `Plus` from lucide-react. */
	icon: React.ComponentType<{ className?: string }>;
	/** Sentence-case label ("Add dessert"). Visible from md, the accessible name on phones. */
	label: string;
	variant?: "default" | "outline" | "secondary";
	disabled?: boolean;
	className?: string;
};

export type PageHeaderActionProps = PageHeaderActionBase &
	({ href: string; onClick?: never } | { href?: never; onClick?: React.MouseEventHandler<HTMLButtonElement> });

/** 44px icon button on phones, icon + label from md. One element, so its accessible name never changes. */
function PageHeaderAction({
	icon: Icon,
	label,
	variant = "default",
	disabled,
	className,
	...rest
}: PageHeaderActionProps) {
	const classes = cn(
		"max-md:size-11 max-md:px-0 [&_svg:not([class*='size-'])]:size-5 md:[&_svg:not([class*='size-'])]:size-4",
		className,
	);
	const content = (
		<>
			<Icon aria-hidden="true" />
			<span className="max-md:sr-only">{label}</span>
		</>
	);

	if ("href" in rest && rest.href) {
		return (
			<Button variant={variant} className={classes} render={<Link href={rest.href} />} aria-disabled={disabled}>
				{content}
			</Button>
		);
	}

	return (
		<Button variant={variant} className={classes} onClick={rest.onClick} disabled={disabled}>
			{content}
		</Button>
	);
}

export { PageHeader, PageHeaderAction };
