"use client";

import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, MoreHorizontal, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	createDessert,
	deleteDessert,
	disableAllDesserts,
	moveDessertToBottom,
	moveDessertToTop,
	toggleDessert,
	updateDessert,
	updateDessertSequence,
} from "@/app/desserts/actions";
import {
	CATALOG_INTENT_PARAM,
	type CatalogArea,
	type CatalogFilter,
	CatalogFilterControl,
	CatalogHeader,
	CatalogReorderBar,
	CatalogSearch,
	readCatalogIntent,
} from "@/components/catalog-toolbar";
import { DessertForm } from "@/components/dessert-form";
import { ActionFeedbackCheckOverlay, useActionFeedback } from "@/components/ui/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSheet } from "@/components/ui/form-sheet";
import { Input } from "@/components/ui/input";
import { ListRow, ListRowTile, ListSection, RecordList } from "@/components/ui/list-row";
import { type ReactiveButtonIcon, useReactiveButton } from "@/components/ui/reactive-button";
import { SaveBar } from "@/components/ui/save-bar";
import { Switch } from "@/components/ui/switch";
import { getInventorySaveLabel } from "@/components/use-inventory";
import { formatINR } from "@/lib/format";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export type InventoryData = {
	quantities: Record<number, string>;
	serverQuantities: Map<number, number>;
	changedDessertIds: Set<number>;
	hasChanges: boolean;
	onQuantityChange: (dessertId: number, value: string) => void;
	onSaveInventory: () => Promise<void>;
	isSaving: boolean;
	saveSuccessCount: number | null;
	saveError: { id: number; message: string } | null;
	todayLabel: string;
};

type StockFilter = CatalogFilter;

const DESSERT_FORM_ID = "dessert-form";

type DessertsTableProps = {
	desserts: Dessert[];
	setDesserts: React.Dispatch<React.SetStateAction<Dessert[]>>;
	onRefetch: () => Promise<void>;
	inventory?: InventoryData;
	/** Which role's catalog this is; sets the Desserts | Combos links. */
	area: CatalogArea;
	className?: string;
};

/**
 * The "Save stock" button with its loading / saved / error feedback, driven by the
 * inventory hook. Shared by Catalog (desserts) and Stock (manager inventory).
 */
export function useInventorySaveButton(inventory: InventoryData | undefined) {
	const successCount = inventory?.saveSuccessCount ?? null;
	const [controls, SaveButton] = useReactiveButton({
		label: "Save stock",
		loading: { label: "Saving…" },
		success: { label: getInventorySaveLabel(successCount ?? 0) },
		feedbackStyle: "brand",
	});
	const { setLoading, setSuccess, setError, reset } = controls;
	const isSaving = inventory?.isSaving ?? false;
	const saveError = inventory?.saveError ?? null;

	// Loading follows the hook's isSaving flag; a save that ends without success returns to idle.
	useEffect(() => {
		if (isSaving) setLoading();
		else reset({ ifStatus: "loading" });
	}, [isSaving, setLoading, reset]);

	// Flash the reported message when a save fails (the id bumps on every failure).
	useEffect(() => {
		if (saveError) setError(saveError.message);
	}, [saveError, setError]);

	// Flash success once a save completes; clearing the count (an edit) dismisses it.
	useEffect(() => {
		if (successCount === null) {
			reset({ ifStatus: "success" });
			return;
		}
		setSuccess(getInventorySaveLabel(successCount));
	}, [successCount, reset, setSuccess]);

	return [controls, SaveButton] as const;
}

/** Puts every changed quantity back to the last saved value. Local only; nothing is written. */
export function discardInventoryChanges(inventory: InventoryData) {
	for (const dessertId of inventory.changedDessertIds) {
		inventory.onQuantityChange(dessertId, String(inventory.serverQuantities.get(dessertId) ?? 0));
	}
}

/** The bottom save bar for stock edits: shown while dirty and while a save is giving feedback. */
export function InventorySaveBar({ inventory }: { inventory: InventoryData }) {
	const [controls, SaveButton] = useInventorySaveButton(inventory);
	const open = inventory.hasChanges || controls.status !== "idle";
	const message = inventory.hasChanges
		? undefined
		: controls.status === "error"
			? "Stock not saved"
			: controls.status === "success"
				? "Stock saved"
				: "Saving stock";

	return (
		<SaveBar
			open={open}
			changes={inventory.changedDessertIds.size}
			message={message}
			onDiscard={inventory.hasChanges ? () => discardInventoryChanges(inventory) : undefined}
			saving={inventory.isSaving}
			saveButton={<SaveButton onClick={inventory.onSaveInventory} disabled={!inventory.hasChanges} />}
		/>
	);
}

/** A 44px quantity field (36px from md) for one dessert's stock today. */
export function StockField({
	dessert,
	value,
	changed,
	onChange,
	disabled,
}: {
	dessert: Pick<Dessert, "id" | "name" | "hasUnlimitedStock">;
	value: string;
	changed: boolean;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	if (dessert.hasUnlimitedStock) {
		return (
			<span className="inline-flex w-[72px] items-center justify-center text-[13px] text-muted-foreground md:w-20">
				Unlimited
			</span>
		);
	}

	return (
		<Input
			type="number"
			inputMode="numeric"
			min={0}
			step={1}
			aria-label={`Stock for ${dessert.name}`}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onFocus={(event) => event.target.select()}
			disabled={disabled}
			className={cn(
				"w-[72px] [appearance:textfield] px-2 text-center font-semibold md:w-20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				changed && "border-primary bg-primary/5 ring-1 ring-primary/30",
			)}
		/>
	);
}

export function DessertsTable({ desserts, setDesserts, onRefetch, inventory, area, className }: DessertsTableProps) {
	const [isDisablingAll, setIsDisablingAll] = useState(false);
	const [confirmDisableAll, setConfirmDisableAll] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	// Kept while the confirmation closes, after the edit form has let go of the dessert.
	const [deleteName, setDeleteName] = useState("");
	const [formDirty, setFormDirty] = useState(false);
	const [movingIds, setMovingIds] = useState<Set<number>>(new Set());
	const [searchTerm, setSearchTerm] = useState("");
	const [filter, setFilter] = useState<StockFilter>("available");
	const [reorderMode, setReorderMode] = useState(false);
	const [openModal, setOpenModal] = useState(false);
	const [editingDessert, setEditingDessert] = useState<Dessert | null>(null);
	const [pinnedEnabled, setPinnedEnabled] = useState<Map<number, boolean>>(new Map());
	const toggleFeedback = useActionFeedback();
	const isEditingDessert = Boolean(editingDessert);

	const [formButton, FormSubmitButton] = useReactiveButton({
		label: isEditingDessert ? "Save" : "Add",
		loading: { label: "Saving…" },
		success: { label: isEditingDessert ? "Updated" : "Added" },
		feedbackStyle: "brand",
	});

	const allDessertNames = useMemo(() => desserts.map((d) => d.name), [desserts]);

	const filteredDesserts = desserts.filter((dessert) => dessert.name.toLowerCase().includes(searchTerm.toLowerCase()));

	const enabledDesserts = filteredDesserts.filter((d) => pinnedEnabled.get(d.id) ?? d.enabled);
	const disabledDesserts = filteredDesserts.filter((d) => !(pinnedEnabled.get(d.id) ?? d.enabled));
	const canDisableAll = !(inventory?.isSaving || desserts.every((d) => !d.enabled));
	const isReordering = reorderMode && filter === "available";
	// Unfiltered counts for the header subtitle; they don't move while searching.
	const onSaleCount = desserts.filter((d) => pinnedEnabled.get(d.id) ?? d.enabled).length;
	const hiddenCount = desserts.length - onSaleCount;
	const canReorder = onSaleCount > 1;

	// The Combos tab's ⋯ menu links here with ?do=reorder / ?do=hide-all. Open the mode or the
	// confirmation once, then drop the parameter so a reload doesn't reopen it.
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const intent = readCatalogIntent(searchParams.get(CATALOG_INTENT_PARAM));
	useEffect(() => {
		if (!intent) return;
		if (intent === "reorder") {
			setFilter("available");
			setReorderMode(true);
		} else if (canDisableAll) {
			// Same guard as the in-page menu item: nothing to hide, or a stock save in flight.
			setConfirmDisableAll(true);
		}
		router.replace(pathname, { scroll: false });
	}, [intent, pathname, router, canDisableAll]);

	const handleToggleDessert = async (dessert: Dessert) => {
		const key = `dessert-toggle-${dessert.id}`;
		const newEnabledState = !dessert.enabled;
		const clearToggleLock = () => {
			setPinnedEnabled((current) => {
				const next = new Map(current);
				next.delete(dessert.id);
				return next;
			});
		};
		setPinnedEnabled((current) => new Map(current).set(dessert.id, dessert.enabled));
		setDesserts((prev) => prev.map((d) => (d.id === dessert.id ? { ...d, enabled: newEnabledState } : d)));
		const generation = toggleFeedback.start(key);

		try {
			await toggleDessert(dessert.id, newEnabledState);
		} catch (error) {
			toggleFeedback.fail(key, { generation, announcement: `Couldn't update ${dessert.name}` });
			console.error("Failed to toggle dessert:", error);
			setDesserts((prev) => prev.map((d) => (d.id === dessert.id ? { ...d, enabled: dessert.enabled } : d)));
			clearToggleLock();
			try {
				await onRefetch();
			} catch (refreshError) {
				console.error("Failed to refresh desserts after toggle failure:", refreshError);
			}
			return;
		}

		try {
			await onRefetch();
		} catch (refreshError) {
			console.warn("Dessert updated, but the latest list could not be refreshed");
			console.error("Failed to refresh desserts after toggle success:", refreshError);
		}

		toggleFeedback.succeed(key, {
			generation,
			duration: 1200,
			announcement: `${dessert.name} ${newEnabledState ? "available" : "hidden"}`,
			onComplete: clearToggleLock,
		});
	};

	const handleEdit = (dessert: Dessert) => {
		setEditingDessert(dessert);
		setOpenModal(true);
	};

	const handleDisableAll = async (): Promise<boolean> => {
		try {
			setIsDisablingAll(true);
			setDesserts((prev) => prev.map((d) => ({ ...d, enabled: false })));
			await disableAllDesserts();
			await onRefetch();
			return true;
		} catch (error) {
			console.error(error);
			await onRefetch();
			return false;
		} finally {
			setIsDisablingAll(false);
		}
	};

	const handleMoveUp = async (dessert: Dessert): Promise<boolean> => {
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex <= 0) return true;
		const targetDessert = enabledDesserts[currentIndex - 1];
		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id) return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id) return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);
			await onRefetch();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveDown = async (dessert: Dessert): Promise<boolean> => {
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex >= enabledDesserts.length - 1) return true;
		const targetDessert = enabledDesserts[currentIndex + 1];
		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id) return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id) return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);
			await onRefetch();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToTop = async (dessert: Dessert): Promise<boolean> => {
		if (!dessert.enabled) return true;
		setMovingIds((prev) => new Set(prev).add(dessert.id));
		try {
			await moveDessertToTop(dessert.id);
			await onRefetch();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToBottom = async (dessert: Dessert): Promise<boolean> => {
		if (!dessert.enabled) return true;
		setMovingIds((prev) => new Set(prev).add(dessert.id));
		try {
			await moveDessertToBottom(dessert.id);
			await onRefetch();
			return true;
		} catch (error) {
			console.error(error);
			return false;
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleSubmit = async (values: Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted">) => {
		const wasEditing = Boolean(editingDessert);
		const token = formButton.setLoading();
		try {
			const trimmedValues = {
				...values,
				name: capitalize(values.name.trim()),
				description: values.description?.trim() || null,
			};
			if (editingDessert) {
				await updateDessert(editingDessert.id, trimmedValues);
			} else {
				await createDessert({ ...trimmedValues, enabled: true });
			}
			await onRefetch();
			formButton.setSuccess(undefined, {
				token,
				duration: 900,
				onComplete: () => {
					setEditingDessert(null);
					setOpenModal(false);
				},
			});
		} catch (error) {
			formButton.setError(`Failed to ${wasEditing ? "update" : "add"}`, { token });
			console.error("Failed to save dessert:", error);
		}
	};

	/** Runs from the delete confirmation; a throw keeps the confirmation open with the message. */
	const handleDelete = async () => {
		if (!editingDessert) return;
		try {
			await deleteDessert(editingDessert.id);
			await onRefetch();
		} catch (error) {
			console.error("Failed to delete dessert:", error);
			throw new Error("Couldn't delete this dessert. Try again.");
		}
		setConfirmDelete(false);
		setEditingDessert(null);
		setOpenModal(false);
	};

	const openCreate = () => {
		setEditingDessert(null);
		setOpenModal(true);
	};

	const changeFilter = (next: StockFilter) => {
		setFilter(next);
		if (next !== "available") setReorderMode(false);
	};

	const renderRow = (dessert: Dessert, index: number, list: Dessert[]) => {
		const enabled = pinnedEnabled.get(dessert.id) ?? dessert.enabled;
		return (
			<DessertRow
				key={dessert.id}
				dessert={dessert}
				enabled={enabled}
				index={index}
				totalCount={list.length}
				reorder={isReordering && enabled}
				isMoving={movingIds.has(dessert.id)}
				inventory={inventory}
				toggleFeedback={toggleFeedback.getState(`dessert-toggle-${dessert.id}`)}
				onToggle={handleToggleDessert}
				onEdit={handleEdit}
				onMoveToTop={handleMoveToTop}
				onMoveUp={handleMoveUp}
				onMoveDown={handleMoveDown}
				onMoveToBottom={handleMoveToBottom}
			/>
		);
	};

	const visibleList = filter === "available" ? enabledDesserts : disabledDesserts;
	const showHiddenMatches = filter === "available" && searchTerm.trim() !== "" && disabledDesserts.length > 0;

	return (
		<div className={cn("w-full", className)}>
			<FormSheet
				open={openModal}
				onOpenChange={(open) => {
					if (!open) {
						formButton.reset();
						setEditingDessert(null);
						setFormDirty(false);
					}
					setOpenModal(open);
				}}
				title={editingDessert ? "Edit dessert" : "Add dessert"}
				dirty={formDirty}
				busy={formButton.isBusy}
				primary={<FormSubmitButton type="submit" form={DESSERT_FORM_ID} size="sm" />}
				menu={
					editingDessert ? (
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								setDeleteName(editingDessert.name);
								setConfirmDelete(true);
							}}
						>
							<Trash2 aria-hidden="true" />
							Delete dessert
						</DropdownMenuItem>
					) : null
				}
			>
				<DessertForm
					key={editingDessert?.id ?? "new"}
					formId={DESSERT_FORM_ID}
					initialData={editingDessert ?? undefined}
					onSubmit={handleSubmit}
					onDirtyChange={setFormDirty}
					existingNames={editingDessert ? allDessertNames.filter((n) => n !== editingDessert.name) : allDessertNames}
				/>
			</FormSheet>
			<ConfirmSheet
				open={confirmDelete}
				onOpenChange={setConfirmDelete}
				title={`Delete ${deleteName}?`}
				description="It leaves the catalog and the Sell screen. Past orders aren't affected."
				confirmLabel="Delete dessert"
				pendingLabel="Deleting…"
				onConfirm={handleDelete}
			/>

			<ConfirmSheet
				open={confirmDisableAll}
				onOpenChange={(open) => !isDisablingAll && setConfirmDisableAll(open)}
				title="Hide all desserts?"
				description="Every dessert leaves the Sell screen until you turn it back on. Use this at closing time."
				confirmLabel="Hide all desserts"
				pendingLabel="Hiding…"
				onConfirm={async () => {
					const ok = await handleDisableAll();
					if (!ok) throw new Error("Couldn't hide the desserts. Try again.");
					setFilter("available");
					setReorderMode(false);
				}}
			/>

			<CatalogHeader
				area={area}
				onSale={onSaleCount}
				hidden={hiddenCount}
				addLabel="Add dessert"
				onAdd={openCreate}
				onReorder={() => {
					setFilter("available");
					setReorderMode(true);
				}}
				reorderDisabled={!canReorder || isReordering}
				onHideAll={() => setConfirmDisableAll(true)}
				hideAllDisabled={!canDisableAll}
			/>

			<div className="flex flex-col gap-3 pb-4">
				<CatalogSearch
					label="Search desserts"
					placeholder="Search desserts"
					value={searchTerm}
					onChange={setSearchTerm}
				/>
				{isReordering ? (
					<CatalogReorderBar onDone={() => setReorderMode(false)} />
				) : (
					<CatalogFilterControl
						label="Show desserts"
						value={filter}
						onValueChange={changeFilter}
						availableCount={enabledDesserts.length}
						hiddenCount={disabledDesserts.length}
					/>
				)}
			</div>

			{visibleList.length > 0 ? (
				<RecordList aria-label={filter === "available" ? "Available desserts" : "Hidden desserts"}>
					{visibleList.map((dessert, index) => renderRow(dessert, index, visibleList))}
				</RecordList>
			) : (
				<DessertsEmpty
					searchTerm={searchTerm}
					filter={filter}
					onClearSearch={() => setSearchTerm("")}
					onShowHidden={() => changeFilter("hidden")}
					hiddenMatches={showHiddenMatches}
				/>
			)}

			{showHiddenMatches && !isReordering ? (
				<ListSection title="Hidden" count={disabledDesserts.length} className="pt-6">
					<RecordList aria-label="Hidden desserts matching your search">
						{disabledDesserts.map((dessert, index) => renderRow(dessert, index, disabledDesserts))}
					</RecordList>
				</ListSection>
			) : null}

			{inventory ? <InventorySaveBar inventory={inventory} /> : null}
		</div>
	);
}

function DessertsEmpty({
	searchTerm,
	filter,
	hiddenMatches,
	onClearSearch,
	onShowHidden,
}: {
	searchTerm: string;
	filter: StockFilter;
	hiddenMatches: boolean;
	onClearSearch: () => void;
	onShowHidden: () => void;
}) {
	const term = searchTerm.trim();
	if (hiddenMatches) return <EmptyState description={`No available desserts match “${term}”.`} />;
	if (term) {
		return (
			<EmptyState
				title={`No desserts match “${term}”`}
				description="Check the spelling or clear the search."
				action={
					<Button variant="outline" size="sm" onClick={onClearSearch}>
						Clear search
					</Button>
				}
			/>
		);
	}
	if (filter === "hidden") return <EmptyState description="No hidden desserts. Every dessert is on the Sell screen." />;
	return (
		<EmptyState
			variant="block"
			title="Nothing is on sale right now"
			description="Turn desserts on from the Hidden list to sell them today."
			action={
				<Button variant="outline" onClick={onShowHidden}>
					Show hidden desserts
				</Button>
			}
		/>
	);
}

type DessertRowProps = {
	dessert: Dessert;
	enabled: boolean;
	index: number;
	totalCount: number;
	reorder: boolean;
	isMoving: boolean;
	inventory?: InventoryData;
	toggleFeedback: ReturnType<ReturnType<typeof useActionFeedback>["getState"]>;
	onToggle: (dessert: Dessert) => void;
	onEdit: (dessert: Dessert) => void;
	onMoveToTop: (dessert: Dessert) => Promise<boolean>;
	onMoveUp: (dessert: Dessert) => Promise<boolean>;
	onMoveDown: (dessert: Dessert) => Promise<boolean>;
	onMoveToBottom: (dessert: Dessert) => Promise<boolean>;
};

function DessertRow({
	dessert,
	enabled,
	index,
	totalCount,
	reorder,
	isMoving,
	inventory,
	toggleFeedback,
	onToggle,
	onEdit,
	onMoveToTop,
	onMoveUp,
	onMoveDown,
	onMoveToBottom,
}: DessertRowProps) {
	const isChanged = inventory?.changedDessertIds.has(dessert.id) ?? false;
	const savedQuantity = inventory?.serverQuantities.get(dessert.id) ?? 0;

	const metaParts: React.ReactNode[] = [formatINR(dessert.price)];
	if (dessert.kind === "modifier") metaParts.push("Add-on");
	if (!enabled) metaParts.push("Hidden");
	if (isChanged && !dessert.hasUnlimitedStock) metaParts.push(`was ${savedQuantity}`);
	const meta = metaParts.join(" · ");

	if (reorder) {
		const isFirst = index === 0;
		const isLast = index === totalCount - 1;
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
							onMove={() => onMoveToTop(dessert)}
							className="@max-xl/main:hidden"
						/>
						<ReorderControl
							icon={ChevronUp}
							title={`Move ${dessert.name} up`}
							disabled={isFirst || isMoving}
							onMove={() => onMoveUp(dessert)}
						/>
						<ReorderControl
							icon={ChevronDown}
							title={`Move ${dessert.name} down`}
							disabled={isLast || isMoving}
							onMove={() => onMoveDown(dessert)}
						/>
						<ReorderControl
							icon={ChevronsDown}
							title={`Move ${dessert.name} to bottom`}
							disabled={isLast || isMoving}
							onMove={() => onMoveToBottom(dessert)}
							className="@max-xl/main:hidden"
						/>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon-touch"
										aria-label={`More moves for ${dessert.name}`}
										className="@xl/main:hidden"
										disabled={isMoving}
									/>
								}
							>
								<MoreHorizontal />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem disabled={isFirst || isMoving} onClick={() => void onMoveToTop(dessert)}>
									<ChevronsUp />
									Move to top
								</DropdownMenuItem>
								<DropdownMenuItem disabled={isLast || isMoving} onClick={() => void onMoveToBottom(dessert)}>
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

	const toggleBusy = toggleFeedback.phase !== "idle";

	return (
		<ListRow
			className={cn(isMoving && "bg-primary/5")}
			title={dessert.name}
			meta={meta}
			onClick={() => onEdit(dessert)}
			rowLabel={`Edit ${dessert.name}`}
			trailingMeta={dessert.isOutOfStock && enabled ? <Badge variant="destructive">Out of stock</Badge> : null}
			action={
				<div className="flex items-center gap-3">
					{inventory && enabled ? (
						<StockField
							dessert={dessert}
							value={inventory.quantities[dessert.id] ?? "0"}
							changed={isChanged}
							onChange={(value) => inventory.onQuantityChange(dessert.id, value)}
						/>
					) : null}
					<span className="flex h-11 items-center">
						<span className="relative inline-flex rounded-full">
							<Switch
								checked={dessert.enabled}
								onCheckedChange={() => onToggle(dessert)}
								disabled={toggleBusy}
								aria-label={`Sell ${dessert.name}`}
							/>
							<ActionFeedbackCheckOverlay phase={toggleFeedback.phase} announcement={toggleFeedback.announcement} />
						</span>
					</span>
				</div>
			}
		/>
	);
}

type ReorderControlProps = {
	icon: ReactiveButtonIcon;
	title: string;
	disabled: boolean;
	onMove: () => Promise<boolean>;
	className?: string;
};

function ReorderControl({ icon, title, disabled, onMove, className }: ReorderControlProps) {
	const [controls, ReactiveIconButton] = useReactiveButton({
		label: "",
		icon,
		loading: { label: "" },
		error: { label: "" },
		feedbackStyle: "neutral",
	});

	const handleClick = async () => {
		const token = controls.setLoading();
		try {
			const ok = await onMove();
			if (ok) controls.reset({ token });
			else controls.setError(undefined, { token });
		} catch (error) {
			controls.setError(undefined, { token });
			console.error(error);
		}
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
