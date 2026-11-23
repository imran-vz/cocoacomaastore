"use client";

import { ArrowUpDown, Check, EyeOff, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageHeader, PageHeaderAction } from "@/components/ui/page-header";
import { SegmentedControl, SegmentedLinks } from "@/components/ui/segmented-control";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CatalogArea = "admin" | "manager";

/** Which records a Catalog tab lists. The same control on Desserts and Combos. */
export type CatalogFilter = "available" | "hidden";

/**
 * A Catalog-level request carried to the Desserts tab when it is picked from the Combos tab's
 * `⋯` menu (`/desserts?do=reorder`). It only opens a mode or a confirmation; nothing is written.
 */
export type CatalogIntent = "reorder" | "hide-all";
export const CATALOG_INTENT_PARAM = "do";

export function readCatalogIntent(value: string | null | undefined): CatalogIntent | null {
	return value === "reorder" || value === "hide-all" ? value : null;
}

/** "Desserts | Combos" switch shown under the Catalog title on both catalog pages. */
export function CatalogLinks({ area, className }: { area: CatalogArea; className?: string }) {
	return (
		<div className={cn("w-full @2xl/main:max-w-xs", className)}>
			<SegmentedLinks
				aria-label="Catalog sections"
				fullWidth
				size="sm"
				items={[
					{ href: `/${area}/desserts`, label: "Desserts" },
					{ href: `/${area}/combos`, label: "Combos" },
				]}
			/>
		</div>
	);
}

type CatalogHeaderProps = {
	area: CatalogArea;
	/** Unfiltered counts, so the subtitle doesn't move while searching. */
	onSale: number;
	hidden: number;
	/** "Add dessert" / "Add combo". */
	addLabel: string;
	onAdd: () => void;
	/**
	 * Desserts tab: open reorder mode / the hide-all confirmation in place.
	 * Combos tab: omit both and the menu links to the Desserts tab, which opens them there.
	 */
	onReorder?: () => void;
	onHideAll?: () => void;
	reorderDisabled?: boolean;
	hideAllDisabled?: boolean;
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
	onReorder,
	onHideAll,
	reorderDisabled,
	hideAllDisabled,
}: CatalogHeaderProps) {
	const router = useRouter();
	const dessertsHref = (intent: CatalogIntent) => `/${area}/desserts?${CATALOG_INTENT_PARAM}=${intent}`;

	return (
		<PageHeader
			title="Catalog"
			description={`${formatNumber(onSale)} on sale · ${formatNumber(hidden)} hidden`}
			action={<PageHeaderAction icon={Plus} label={addLabel} onClick={onAdd} />}
			secondary={
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="ghost" size="icon-touch" aria-label="More catalog actions" className="md:size-9" />
						}
					>
						<MoreHorizontal />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuItem
							disabled={reorderDisabled}
							onClick={() => (onReorder ? onReorder() : router.push(dessertsHref("reorder")))}
						>
							<ArrowUpDown aria-hidden="true" />
							Reorder desserts
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							disabled={hideAllDisabled}
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
			fullWidth
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
			className="flex min-h-11 items-center gap-3 rounded-[10px] bg-primary/10 py-1 pr-1 pl-4 md:min-h-9"
		>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold text-primary">Reordering</p>
				<p className="text-[13px] text-muted-foreground text-pretty">
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

/** Search field with a leading icon and a 44px clear button. */
export function CatalogSearch({
	value,
	onChange,
	placeholder,
	label,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	/** Accessible name ("Search desserts"). */
	label: string;
	className?: string;
}) {
	const id = useId();
	return (
		<div className={cn("relative w-full", className)}>
			<label htmlFor={id} className="sr-only">
				{label}
			</label>
			<Search
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground md:size-4"
			/>
			<Input
				id={id}
				type="text"
				inputMode="search"
				enterKeyHint="search"
				autoComplete="off"
				placeholder={placeholder}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="pr-11 pl-10 md:pl-9"
			/>
			{value ? (
				<Button
					variant="ghost"
					size="icon-touch"
					aria-label="Clear search"
					onClick={() => onChange("")}
					className="absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground md:size-9 md:[&_svg:not([class*='size-'])]:size-4"
				>
					<X />
				</Button>
			) : null}
		</div>
	);
}
