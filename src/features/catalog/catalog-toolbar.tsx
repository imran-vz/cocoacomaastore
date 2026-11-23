"use client";

import { ArrowUpDown, Check, EyeOff, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, MoreMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { SegmentedControl, SegmentedLinks, segmentedTrackShapeClassName } from "@/components/ui/segmented-control";
import type { Area } from "@/features/access/area";
import { sectionHref, sectionViews } from "@/features/shell/routes";
import { usePageTitle } from "@/features/shell/use-page-chrome";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Which records a Catalog tab lists. The same control on Desserts and Combos. */
export type CatalogFilter = "available" | "hidden";

/**
 * A Catalog-level request carried to the Desserts tab when it is picked from the Combos tab's
 * `⋯` menu (`/desserts?do=reorder`). It only opens a mode or a confirmation; nothing is written.
 */
type CatalogIntent = "reorder" | "hide-all";
export const CATALOG_INTENT_PARAM = "do";

export function readCatalogIntent(value: string | null | undefined): CatalogIntent | null {
	return value === "reorder" || value === "hide-all" ? value : null;
}

/** "Desserts | Combos" switch shown under the Catalog title on both catalog pages. */
export function CatalogLinks({ area, className }: { area: Area; className?: string }) {
	return (
		<div className={cn("w-full @2xl/main:max-w-xs", className)}>
			<SegmentedLinks aria-label="Catalog sections" size="sm" items={sectionViews(area, "catalog")} />
		</div>
	);
}

type CatalogHeaderProps = {
	area: Area;
	/** Unfiltered counts, so the subtitle doesn't move while searching. */
	onSale: number;
	hidden: number;
	/** "Add dessert" / "Add combo". */
	addLabel: string;
	onAdd: () => void;
	canReorder: boolean;
	canHideAll: boolean;
	/**
	 * Desserts tab: open reorder mode / the hide-all confirmation in place.
	 * Combos tab: omit both and the menu links to the Desserts tab, which opens them there.
	 */
	onReorder?: () => void;
	onHideAll?: () => void;
};

/**
 * One header for both Catalog tabs (Desserts | Combos): the same title, a stable
 * "11 on sale · 131 hidden" subtitle and the same right slot (`⋯` + "+"), so nothing
 * moves when you switch tabs.
 */
export function CatalogHeader({
	area,
	onSale,
	hidden,
	addLabel,
	onAdd,
	canReorder,
	canHideAll,
	onReorder,
	onHideAll,
}: CatalogHeaderProps) {
	const router = useRouter();
	const title = usePageTitle();
	const dessertsHref = (intent: CatalogIntent) => `${sectionHref(area, "catalog")}?${CATALOG_INTENT_PARAM}=${intent}`;

	return (
		<PageHeader
			title={title}
			description={`${formatNumber(onSale)} on sale · ${formatNumber(hidden)} hidden`}
			action={<PageHeaderAction icon={Plus} label={addLabel} onClick={onAdd} />}
			secondary={
				<DropdownMenu>
					<MoreMenuTrigger label="More catalog actions" size="icon" />
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuItem
							disabled={!canReorder}
							onClick={() => (onReorder ? onReorder() : router.push(dessertsHref("reorder")))}
						>
							<ArrowUpDown aria-hidden="true" />
							Reorder desserts
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							disabled={!canHideAll}
							onClick={() => (onHideAll ? onHideAll() : router.push(dessertsHref("hide-all")))}
						>
							<EyeOff aria-hidden="true" />
							Hide all desserts
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			}
		>
			<CatalogLinks area={area} />
		</PageHeader>
	);
}

/**
 * The filter row under the search field: a full-width Available | Hidden control on both
 * tabs. Counts follow the search.
 */
export function CatalogFilterControl({
	label,
	value,
	onValueChange,
	availableCount,
	hiddenCount,
}: {
	/** Accessible name ("Show desserts"). */
	label: string;
	value: CatalogFilter;
	onValueChange: (value: CatalogFilter) => void;
	availableCount: number;
	hiddenCount: number;
}) {
	return (
		<SegmentedControl
			aria-label={label}
			size="sm"
			value={value}
			onValueChange={onValueChange}
			options={[
				{ value: "available", label: "Available", count: availableCount },
				{ value: "hidden", label: "Hidden", count: hiddenCount },
			]}
		/>
	);
}

/** Replaces the filter row while desserts are being reordered: names the mode and ends it. */
export function CatalogReorderBar({ onDone }: { onDone: () => void }) {
	return (
		<section
			aria-label="Reordering desserts"
			className={cn(segmentedTrackShapeClassName(), "flex items-center gap-3 bg-primary/10 py-1 pr-1 pl-4")}
		>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold text-primary">Reordering</p>
				<p className="text-meta text-muted-foreground text-pretty">
					Sets the order on the Sell screen. Saves as you go.
				</p>
			</div>
			<Button onClick={onDone} className="shrink-0">
				<Check aria-hidden="true" />
				Done
			</Button>
		</section>
	);
}
