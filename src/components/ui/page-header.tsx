import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const HEADER_CLASS = "flex flex-col gap-4 pb-4 md:pb-6";
const TITLE_ROW_CLASS = "flex min-h-11 items-center gap-3";
const CONTROLS_CLASS = "flex shrink-0 items-center gap-2";

/**
 * The header every screen starts with (DESIGN.md §Page header). `children` is the one row
 * under the title. The `<h1>` carries `data-app-title`, which the shell's top bar watches to
 * show the title only once this heading scrolls away.
 */
function PageHeader({
	title,
	description,
	action,
	secondary,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"header">, "title"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	/** The page's single primary action, a `PageHeaderAction`. */
	action?: React.ReactNode;
	/** Quiet controls next to the action, such as a `⋯` menu. */
	secondary?: React.ReactNode;
}) {
	return (
		<header data-slot="page-header" className={cn(HEADER_CLASS, className)} {...props}>
			<div className={TITLE_ROW_CLASS}>
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
					<div className={CONTROLS_CLASS}>
						{secondary}
						{action ? <div className="flex items-center">{action}</div> : null}
					</div>
				) : null}
			</div>
			{children}
		</header>
	);
}

/** The page's primary action: a 44px icon button on phones, icon + label from md. One element, so its accessible name never changes. */
function PageHeaderAction({
	icon: Icon,
	label,
	onClick,
}: {
	/** Icon component, e.g. `Plus` from lucide-react. */
	icon: React.ComponentType<{ className?: string }>;
	/** Sentence-case label ("Add dessert"): visible from md, the accessible name on phones. */
	label: string;
	onClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
	return (
		<Button
			className="max-md:size-11 max-md:px-0 [&_svg:not([class*='size-'])]:size-5 md:[&_svg:not([class*='size-'])]:size-4"
			onClick={onClick}
		>
			<Icon aria-hidden="true" />
			<span className="max-md:sr-only">{label}</span>
		</Button>
	);
}

/** `PageHeader` while its page loads: the title, an optional description line and controls, one row under it. */
function PageHeaderSkeleton({
	titleWidth = "w-32",
	description = false,
	secondary = false,
	action = false,
	children,
}: {
	titleWidth?: string;
	description?: boolean;
	/** Quiet secondary controls (a `⋯` button). */
	secondary?: boolean;
	/** A `PageHeaderAction`. */
	action?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<div className={HEADER_CLASS}>
			<div className={TITLE_ROW_CLASS}>
				<div className="min-w-0 flex-1">
					<Skeleton className={cn("my-0.5 h-6 max-w-full md:h-7", titleWidth)} />
					{description ? <Skeleton className="mt-1.5 h-4 w-56 max-w-full" /> : null}
				</div>
				{secondary || action ? (
					<div className={CONTROLS_CLASS}>
						{secondary ? <Skeleton className="size-11 rounded-lg md:size-9" /> : null}
						{action ? <Skeleton className="size-11 rounded-lg md:h-9 md:w-32" /> : null}
					</div>
				) : null}
			</div>
			{children}
		</div>
	);
}

export { PageHeader, PageHeaderAction, PageHeaderSkeleton };
