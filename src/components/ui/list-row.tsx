import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

/**
 * Responsive records (DESIGN.md §Records). Below md every record list is a `RecordList`
 * of `ListRow`s inside one bordered card; from md a page may keep its `Table`.
 *
 * ```tsx
 * <ListSection title="Managers" count={3}>
 *   <RecordList aria-label="Managers">
 *     <ListRow
 *       leading={<ListRowTile>CM</ListRowTile>}
 *       title="Council Manager"
 *       meta="council.manager@cocoacomaa.test · Added 17 Dec 2025"
 *       trailing="Manager"
 *       action={<RowMenu />}
 *     />
 *   </RecordList>
 * </ListSection>
 * ```
 */
function RecordList({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="record-list"
			className={cn("divide-y divide-border overflow-hidden rounded-xl border bg-card text-card-foreground", className)}
			{...props}
		/>
	);
}

/** A titled group of records: the shared `SectionHeading` above a list. */
function ListSection({
	title,
	count,
	action,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"section">, "title"> & {
	title: React.ReactNode;
	count?: number | string;
	action?: React.ReactNode;
}) {
	return (
		<section data-slot="list-section" className={cn("flex flex-col", className)} {...props}>
			<SectionHeading title={title} count={count} action={action} />
			{children}
		</section>
	);
}

/** 40px leading tile: initials, an icon or a thumbnail. Neutral by default. */
function ListRowTile({
	className,
	tone = "neutral",
	...props
}: React.ComponentProps<"span"> & { tone?: "neutral" | "brand" }) {
	return (
		<span
			data-slot="list-row-tile"
			className={cn(
				"flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold [&_svg:not([class*='size-'])]:size-5",
				tone === "brand" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export type ListRowProps = Omit<React.ComponentProps<"li">, "title" | "onClick"> & {
	/** Optional 40px tile or avatar (`ListRowTile`). */
	leading?: React.ReactNode;
	/** 15/600, wraps to two lines. */
	title: React.ReactNode;
	/** 13 muted, wraps. Join parts with " · ". */
	meta?: React.ReactNode;
	/** Right-aligned value (amount, stock) — tabular figures. */
	trailing?: React.ReactNode;
	/** Small line under the trailing value (a status word or badge). */
	trailingMeta?: React.ReactNode;
	/**
	 * One trailing control outside the row's tap area (a Switch, a 44px icon button or a
	 * `⋯` menu). It never triggers the row's own navigation.
	 */
	action?: React.ReactNode;
	/** Makes the row a link to a detail screen. Shows a chevron. */
	href?: string;
	/** Makes the row a button (e.g. opens an edit sheet). Shows a chevron. */
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	/** Override the chevron; defaults to shown when the row has `href` or `onClick`. */
	chevron?: boolean;
	/** Accessible name for the row's tap area when the title alone is ambiguous. */
	rowLabel?: string;
};

function ListRow({
	leading,
	title,
	meta,
	trailing,
	trailingMeta,
	action,
	href,
	onClick,
	chevron,
	rowLabel,
	className,
	...props
}: ListRowProps) {
	const interactive = Boolean(href || onClick);
	const showChevron = chevron ?? interactive;

	const body = (
		<>
			{leading}
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-[15px] leading-5 font-semibold text-foreground line-clamp-2 break-words">{title}</span>
				{meta ? (
					<span className="text-[13px] leading-[18px] text-muted-foreground break-words tabular-nums">{meta}</span>
				) : null}
			</span>
			{trailing || trailingMeta ? (
				<span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
					{trailing ? (
						<span className="text-[15px] leading-5 font-semibold text-foreground tabular-nums">{trailing}</span>
					) : null}
					{trailingMeta ? (
						<span className="text-[13px] leading-[18px] text-muted-foreground">{trailingMeta}</span>
					) : null}
				</span>
			) : null}
			{showChevron ? <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/70" /> : null}
		</>
	);

	const areaClass = cn(
		"flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left",
		action ? "pr-2" : "pr-4",
		showChevron && !action && "pr-3",
		interactive &&
			"outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--focus-ring)",
	);

	let area: React.ReactNode;
	if (href) {
		area = (
			<Link href={href} data-slot="list-row-area" className={areaClass} aria-label={rowLabel}>
				{body}
			</Link>
		);
	} else if (onClick) {
		area = (
			<button type="button" onClick={onClick} data-slot="list-row-area" className={areaClass} aria-label={rowLabel}>
				{body}
			</button>
		);
	} else {
		area = (
			<div data-slot="list-row-area" className={areaClass}>
				{body}
			</div>
		);
	}

	return (
		<li
			data-slot="list-row"
			className={cn(
				"flex items-center",
				// The tint spans the whole row (trailing action included); the row area and the
				// action stay separate tap targets. Pressing the action doesn't tint the row.
				interactive && "transition-colors hover:bg-muted/60 has-[>[data-slot=list-row-area]:active]:bg-muted",
				className,
			)}
			{...props}
		>
			{area}
			{action ? (
				<div
					data-slot="list-row-action"
					className="flex min-w-11 shrink-0 items-center justify-center self-stretch pr-3"
				>
					{action}
				</div>
			) : null}
		</li>
	);
}

export { ListRow, ListRowTile, ListSection, RecordList };
