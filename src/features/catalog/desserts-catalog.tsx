"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useEffectEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, MoreMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRowTile } from "@/components/ui/list-row";
import { type ReactiveButtonIcon, useReactiveButton } from "@/components/ui/reactive-button";
import { SearchField } from "@/components/ui/search-field";
import type { Area } from "@/features/access/area";
import { hideAllDesserts, moveDessert, setDessertListed } from "@/features/catalog/actions";
import { CatalogRecords, ListingSwitch, useCatalogList } from "@/features/catalog/catalog-list";
import {
	CATALOG_INTENT_PARAM,
	CatalogFilterControl,
	CatalogHeader,
	CatalogReorderBar,
	readCatalogIntent,
} from "@/features/catalog/catalog-toolbar";
import { dessertsQuery } from "@/features/catalog/client";
import { DessertFormSheet } from "@/features/catalog/dessert-form";
import { moveInSellOrder, sequencesFor } from "@/features/catalog/dessert-order";
import type { Dessert } from "@/features/catalog/queries";
import type { MoveDirection } from "@/features/catalog/schemas";
import { type DayInventory, isCounted } from "@/features/inventory/shapes";
import { StockField, StockSaveBar, startingCountNote } from "@/features/inventory/stock-ui";
import { type StockCount, useStockCount } from "@/features/inventory/use-stock-count";
import { useTodayInventory } from "@/features/inventory/use-today-inventory";
import { useRunAction } from "@/lib/action-result";
import { formatINR, UNIT } from "@/lib/format";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";
import { cn } from "@/lib/utils";

/** The Desserts tab of the Catalog: what's on sale, its order, and today's stock. */
export function DessertsCatalog({
	area,
	desserts: initialDesserts,
	inventory: initialInventory,
}: {
	area: Area;
	/** Every listed dessert, hidden ones included. */
	desserts: Promise<ServerSnapshot<Dessert[]>>;
	inventory: Promise<ServerSnapshot<DayInventory>>;
}) {
	const queryClient = useQueryClient();
	const runAction = useRunAction();
	const { data: desserts, refetch } = useSeededQuery(dessertsQuery, use(initialDesserts));
	const setDesserts = (update: (desserts: Dessert[]) => Dessert[]) =>
		queryClient.setQueryData(dessertsQuery.queryKey, (current) =>
			current ? { ...current, data: update(current.data) } : current,
		);
	const stock = useStockCount(desserts, useTodayInventory(use(initialInventory)));

	const list = useCatalogList({ records: desserts, setRecords: setDesserts, refetch, setListed: setDessertListed });
	// The dessert stays set while the sheet closes, so its title doesn't change mid-animation.
	const [editor, setEditor] = useState<{ open: boolean; dessert: Dessert | null }>({ open: false, dessert: null });
	const openEditor = (dessert: Dessert | null) => setEditor({ open: true, dessert });
	const [reorderMode, setReorderMode] = useState(false);
	const [movingIds, setMovingIds] = useState<ReadonlySet<number>>(new Set());
	const [confirmHideAll, setConfirmHideAll] = useState(false);
	const isReordering = reorderMode && list.filter === "available";

	// Moves follow the whole Sell-screen order, so reordering shows all of it: no search.
	const startReorder = () => {
		list.setSearchTerm("");
		list.setFilter("available");
		setReorderMode(true);
	};

	// The Combos tab's ⋯ menu links here with ?do=reorder / ?do=hide-all. Open the mode or the
	// confirmation once, then drop the parameter so a reload doesn't reopen it.
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const intent = readCatalogIntent(searchParams.get(CATALOG_INTENT_PARAM));
	const openIntent = useEffectEvent((opened: NonNullable<typeof intent>) => {
		if (opened === "reorder") startReorder();
		else if (list.onSaleCount > 0) setConfirmHideAll(true);
		router.replace(pathname, { scroll: false });
	});
	useEffect(() => {
		if (intent) openIntent(intent);
	}, [intent]);

	const move = async (dessert: Dessert, direction: MoveDirection): Promise<boolean> => {
		setMovingIds((current) => new Set(current).add(dessert.id));
		const moved = moveInSellOrder(desserts, dessert.id, direction);
		if (moved) setDesserts(() => sequencesFor(moved));
		try {
			const result = await runAction(moveDessert(dessert.id, direction));
			if (!result.ok) await refetch();
			return result.ok;
		} finally {
			setMovingIds((current) => {
				const next = new Set(current);
				next.delete(dessert.id);
				return next;
			});
		}
	};

	const hideAll = async () => {
		setDesserts((current) => current.map((dessert) => ({ ...dessert, enabled: false })));
		const result = await runAction(hideAllDesserts());
		if (!result.ok) {
			await refetch();
			return result;
		}
		list.setFilter("available");
		setReorderMode(false);
	};

	const renderRows = (rows: Dessert[]) =>
		rows.map((dessert, index) => {
			const listed = list.isListed(dessert);
			return isReordering && listed ? (
				<ReorderRow
					key={dessert.id}
					dessert={dessert}
					index={index}
					isLast={index === rows.length - 1}
					isMoving={movingIds.has(dessert.id)}
					onMove={(direction) => move(dessert, direction)}
				/>
			) : (
				<DessertRow
					key={dessert.id}
					dessert={dessert}
					listed={listed}
					stock={stock}
					isMoving={movingIds.has(dessert.id)}
					listing={
						<ListingSwitch
							name={dessert.name}
							checked={dessert.enabled}
							status={list.toggleStatus(dessert.id)}
							onToggle={() => void list.toggle(dessert)}
						/>
					}
					onEdit={() => openEditor(dessert)}
				/>
			);
		});

	return (
		<div className="w-full">
			<DessertFormSheet
				open={editor.open}
				onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
				dessert={editor.dessert}
				desserts={desserts}
			/>
			<ConfirmSheet
				open={confirmHideAll}
				onOpenChange={setConfirmHideAll}
				title="Hide all desserts?"
				description="Every dessert leaves the Sell screen until you turn it back on. Use this at closing time."
				confirmLabel="Hide all desserts"
				pendingLabel="Hiding…"
				onConfirm={hideAll}
			/>

			<CatalogHeader
				area={area}
				onSale={list.onSaleCount}
				hidden={list.hiddenCount}
				addLabel="Add dessert"
				onAdd={() => openEditor(null)}
				canReorder={list.onSaleCount >= 2 && !isReordering}
				canHideAll={list.onSaleCount > 0 && !stock.isSaving}
				onReorder={startReorder}
				onHideAll={() => setConfirmHideAll(true)}
			/>

			<div className="flex flex-col gap-3 pb-4">
				{isReordering ? (
					<CatalogReorderBar onDone={() => setReorderMode(false)} />
				) : (
					<>
						<SearchField label="Search desserts" value={list.searchTerm} onChange={list.setSearchTerm} />
						<CatalogFilterControl
							label="Show desserts"
							value={list.filter}
							onValueChange={(next) => {
								list.setFilter(next);
								if (next !== "available") setReorderMode(false);
							}}
							availableCount={list.available.length}
							hiddenCount={list.hidden.length}
						/>
					</>
				)}
			</div>

			<CatalogRecords
				list={list}
				noun={UNIT.dessert}
				renderRows={renderRows}
				withHiddenMatches={!isReordering}
				whenNoneOnSale={
					<EmptyState
						variant="block"
						title="Nothing is on sale right now"
						description="Turn desserts on from the Hidden list to sell them today."
						action={
							<Button variant="outline" onClick={() => list.setFilter("hidden")}>
								Show hidden desserts
							</Button>
						}
					/>
				}
			/>

			<StockSaveBar stock={stock} />
		</div>
	);
}

function DessertRow({
	dessert,
	listed,
	stock,
	isMoving,
	listing,
	onEdit,
}: {
	dessert: Dessert;
	listed: boolean;
	stock: StockCount;
	isMoving: boolean;
	listing: React.ReactNode;
	onEdit: () => void;
}) {
	const countable = { ...dessert, enabled: listed };
	const meta = [
		formatINR(dessert.price),
		dessert.kind === "modifier" ? "Add-on" : null,
		listed ? null : "Hidden",
		isCounted(countable) ? startingCountNote(stock, dessert.id) : null,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<ListRow
			className={cn(isMoving && "bg-primary/5")}
			title={dessert.name}
			meta={meta}
			onClick={onEdit}
			rowLabel={`Edit ${dessert.name}`}
			trailingMeta={dessert.isOutOfStock && listed ? <Badge variant="destructive">Out of stock</Badge> : null}
			action={
				<div className="flex items-center gap-3">
					{listed ? <StockField stock={stock} dessert={countable} /> : null}
					{listing}
				</div>
			}
		/>
	);
}

function ReorderRow({
	dessert,
	index,
	isLast,
	isMoving,
	onMove,
}: {
	dessert: Dessert;
	index: number;
	isLast: boolean;
	isMoving: boolean;
	onMove: (direction: MoveDirection) => Promise<boolean>;
}) {
	const isFirst = index === 0;
	return (
		<ListRow
			className={cn(isMoving && "bg-primary/5")}
			leading={<ListRowTile className="tabular-nums max-[379px]:hidden">{index + 1}</ListRowTile>}
			title={dessert.name}
			meta={formatINR(dessert.price)}
			action={
				<div className="flex items-center">
					<ReorderControl
						icon={ChevronsUp}
						title={`Move ${dessert.name} to top`}
						disabled={isFirst || isMoving}
						onMove={() => onMove("top")}
						className="@max-xl/main:hidden"
					/>
					<ReorderControl
						icon={ChevronUp}
						title={`Move ${dessert.name} up`}
						disabled={isFirst || isMoving}
						onMove={() => onMove("up")}
					/>
					<ReorderControl
						icon={ChevronDown}
						title={`Move ${dessert.name} down`}
						disabled={isLast || isMoving}
						onMove={() => onMove("down")}
					/>
					<ReorderControl
						icon={ChevronsDown}
						title={`Move ${dessert.name} to bottom`}
						disabled={isLast || isMoving}
						onMove={() => onMove("bottom")}
						className="@max-xl/main:hidden"
					/>
					<DropdownMenu>
						<MoreMenuTrigger label={`More moves for ${dessert.name}`} className="@xl/main:hidden" disabled={isMoving} />
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem disabled={isFirst || isMoving} onClick={() => void onMove("top")}>
								<ChevronsUp />
								Move to top
							</DropdownMenuItem>
							<DropdownMenuItem disabled={isLast || isMoving} onClick={() => void onMove("bottom")}>
								<ChevronsDown />
								Move to bottom
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			}
		/>
	);
}

function ReorderControl({
	icon,
	title,
	disabled,
	onMove,
	className,
}: {
	icon: ReactiveButtonIcon;
	title: string;
	disabled: boolean;
	onMove: () => Promise<boolean>;
	className?: string;
}) {
	const [controls, ReactiveIconButton] = useReactiveButton({
		label: "",
		icon,
		loading: { label: "" },
		error: { label: "" },
	});

	const handleClick = async () => {
		const token = controls.setLoading();
		if (await onMove()) controls.reset({ token });
		else controls.setError(undefined, { token });
	};

	return (
		<ReactiveIconButton
			variant="ghost"
			size="icon-touch"
			onClick={handleClick}
			disabled={disabled}
			className={className}
			title={title}
			aria-label={title}
		/>
	);
}
