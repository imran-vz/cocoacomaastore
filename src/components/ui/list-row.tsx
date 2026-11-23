import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton, skeletonSlots } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Records as a list (DESIGN.md §Records).
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
const ROW_AREA_CLASS = "flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left";

function RecordList({ className, ...props }: React.ComponentProps<"ul">) {
	return <ul data-slot="record-list" className={cn("surface-card divide-y overflow-hidden", className)} {...props} />;
}

/** A titled group of records: the shared `SectionHeading` above a list. */
function ListSection({
	title,
	count,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"section">, "title"> & {
	title: React.ReactNode;
	count?: number | string;
}) {
	return (
		<section data-slot="list-section" className={cn("flex flex-col", className)} {...props}>
			<SectionHeading title={title} count={count} />
			{children}
		</section>
	);
}

/** 40px leading tile: initials, an icon or a thumbnail. */
function ListRowTile({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="list-row-tile"
			className={cn(
				"flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-sm font-semibold text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
				className,
			)}
			{...props}
		/>
	);
}

type ListRowProps = Omit<React.ComponentProps<"li">, "title" | "onClick"> & {
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
	rowLabel,
	className,
	...props
}: ListRowProps) {
	const interactive = Boolean(href || onClick);

	const body = (
		<>
			{leading}
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="text-row text-foreground line-clamp-2 break-words">{title}</span>
				{meta ? <span className="text-meta text-muted-foreground break-words tabular-nums">{meta}</span> : null}
			</span>
			{trailing || trailingMeta ? (
				<span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
					{trailing ? <span className="text-row text-foreground tabular-nums">{trailing}</span> : null}
					{trailingMeta ? <span className="text-meta text-muted-foreground">{trailingMeta}</span> : null}
				</span>
			) : null}
			{interactive ? <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/70" /> : null}
		</>
	);

	const areaClass = cn(
		ROW_AREA_CLASS,
		action ? "pr-2" : interactive ? "pr-3" : "pr-4",
		interactive && "focus-ring-inset",
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

/** A `RecordList` of `ListRow`s while its page loads. */
function RecordListSkeleton({
	rows,
	leading = false,
	metaLines = 1,
	trailing = false,
	action,
	chevron = false,
}: {
	rows: number;
	leading?: boolean;
	metaLines?: 0 | 1 | 2;
	trailing?: boolean;
	action?: "switch" | "icon";
	chevron?: boolean;
}) {
	return (
		<RecordList aria-hidden="true">
			{skeletonSlots(rows).map((slot) => (
				<li key={slot} className={cn(ROW_AREA_CLASS, "pr-4")}>
					{leading ? <Skeleton className="size-10 shrink-0 rounded-lg" /> : null}
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-4 w-40 max-w-full" />
						{metaLines >= 1 ? <Skeleton className="h-3 w-52 max-w-full" /> : null}
						{metaLines >= 2 ? <Skeleton className="h-3 w-32 max-w-full" /> : null}
					</div>
					{chevron ? <Skeleton className="size-4 shrink-0 rounded" /> : null}
					{trailing ? <Skeleton className="h-4 w-14 shrink-0" /> : null}
					{action === "switch" ? <Skeleton className="h-6 w-10 shrink-0 rounded-full md:h-[18px] md:w-8" /> : null}
					{action === "icon" ? <Skeleton className="size-6 shrink-0 rounded-md" /> : null}
				</li>
			))}
		</RecordList>
	);
}

export { ListRow, ListRowTile, ListSection, RecordList, RecordListSkeleton };
