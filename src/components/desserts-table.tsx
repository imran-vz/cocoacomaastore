"use client";

import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, Infinity as InfinityIcon, Pencil } from "lucide-react";
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
import { DessertForm } from "@/components/dessert-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	ReactiveButton,
	type ReactiveButtonControls,
	type ReactiveButtonIcon,
	useReactiveButton,
} from "@/components/ui/reactive-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventorySaveLabel } from "@/components/use-inventory";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

type InventoryData = {
	quantities: Record<number, string>;
	serverQuantities: Map<number, number>;
	changedDessertIds: Set<number>;
	hasChanges: boolean;
	onQuantityChange: (dessertId: number, value: string) => void;
	onSaveInventory: () => Promise<void>;
	isSaving: boolean;
	saveSuccessCount: number | null;
	todayLabel: string;
};

type DessertsTableProps = {
	desserts: Dessert[];
	setDesserts: React.Dispatch<React.SetStateAction<Dessert[]>>;
	onRefetch: () => Promise<void>;
	inventory?: InventoryData;
	title?: string;
	subtitle?: string;
	maxWidth?: string;
};

export function DessertsTable({
	desserts,
	setDesserts,
	onRefetch,
	inventory,
	title = "Desserts",
	subtitle,
	maxWidth = "max-w-4xl",
}: DessertsTableProps) {
	const [isDisablingAll, setIsDisablingAll] = useState(false);
	const [disableAllError, setDisableAllError] = useState(false);
	const [movingIds, setMovingIds] = useState<Set<number>>(new Set());
	const [searchTerm, setSearchTerm] = useState("");
	const [openModal, setOpenModal] = useState(false);
	const [editingDessert, setEditingDessert] = useState<Dessert | null>(null);
	const [pinnedEnabled, setPinnedEnabled] = useState<Map<number, boolean>>(new Map());
	const inventorySuccessCount = inventory?.saveSuccessCount ?? null;
	const hasInventory = Boolean(inventory);
	const isEditingDessert = Boolean(editingDessert);

	const [formButton, FormSubmitButton] = useReactiveButton({
		label: isEditingDessert ? "Update Dessert" : "Add Dessert",
		loading: { label: "Saving..." },
		success: { label: isEditingDessert ? "Updated" : "Added" },
		feedbackStyle: "brand",
	});

	const [inventoryButton, InventorySaveButton] = useReactiveButton({
		label: (
			<>
				Save Stock
				{inventory?.hasChanges && (
					<span className="rounded-full bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-800">
						{inventory.changedDessertIds.size}
					</span>
				)}
			</>
		),
		loading: { label: "Saving..." },
		success: { label: getInventorySaveLabel(inventorySuccessCount ?? 0) },
		feedbackStyle: "brand",
	});

	const { setLoading: setInventoryLoading, setSuccess: setInventorySuccess, reset: resetInventory } = inventoryButton;

	useEffect(() => {
		if (!hasInventory) return;
		if (inventory?.isSaving) {
			setInventoryLoading();
			return;
		}
		if (inventorySuccessCount !== null) {
			setInventorySuccess(getInventorySaveLabel(inventorySuccessCount));
		} else {
			resetInventory();
		}
	}, [
		hasInventory,
		inventory?.isSaving,
		inventorySuccessCount,
		setInventoryLoading,
		setInventorySuccess,
		resetInventory,
	]);

	const allDessertNames = useMemo(() => desserts.map((d) => d.name), [desserts]);

	const filteredDesserts = desserts.filter((dessert) => dessert.name.toLowerCase().includes(searchTerm.toLowerCase()));

	const enabledDesserts = filteredDesserts.filter((d) => pinnedEnabled.get(d.id) ?? d.enabled);
	const disabledDesserts = filteredDesserts.filter((d) => !(pinnedEnabled.get(d.id) ?? d.enabled));

	const handleToggleDessert = async (dessert: Dessert, controls: ReactiveButtonControls) => {
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
		const token = controls.setLoading();

		try {
			await toggleDessert(dessert.id, newEnabledState);
		} catch (error) {
			controls.setError(undefined, { token });
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

		controls.setSuccess(undefined, {
			token,
			duration: 1200,
			onComplete: clearToggleLock,
		});
	};

	const handleEdit = (dessert: Dessert) => {
		setEditingDessert(dessert);
		setOpenModal(true);
	};

	const handleDisableAll = async () => {
		setDisableAllError(false);
		try {
			setIsDisablingAll(true);
			setDesserts((prev) => prev.map((d) => ({ ...d, enabled: false })));
			await disableAllDesserts();
			await onRefetch();
		} catch (error) {
			setDisableAllError(true);
			console.error(error);
			await onRefetch();
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

	const handleDelete = async () => {
		if (!editingDessert) return;
		const token = formButton.setLoading();
		try {
			await deleteDessert(editingDessert.id);
			await onRefetch();
			setEditingDessert(null);
			setOpenModal(false);
		} catch (error) {
			formButton.setError("Delete failed", { token });
			console.error("Failed to delete dessert:", error);
		}
	};

	const renderTableHeader = () => (
		<TableHeader>
			<TableRow className="bg-muted/50">
				<TableHead className="w-16">#</TableHead>
				<TableHead>Dessert</TableHead>
				{inventory && <TableHead className="w-24 text-center">Stock</TableHead>}
				<TableHead className="w-16 text-center">Edit</TableHead>
				<TableHead className="w-20 text-center">Status</TableHead>
			</TableRow>
		</TableHeader>
	);

	return (
		<div className={cn("space-y-4", maxWidth, "mx-auto")}>
			<Dialog
				open={openModal}
				onOpenChange={(open) => {
					if (!open) formButton.reset();
					setOpenModal(open);
					if (!open) setEditingDessert(null);
				}}
			>
				<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 md:-mt-28">
					<DialogHeader>
						<DialogTitle>{editingDessert ? "Edit Dessert" : "Add New Dessert"}</DialogTitle>
					</DialogHeader>
					<DessertForm
						key={editingDessert?.id}
						initialData={editingDessert ?? undefined}
						onSubmit={handleSubmit}
						onDelete={handleDelete}
						submitControls={formButton}
						SubmitButton={FormSubmitButton}
						existingNames={editingDessert ? allDessertNames.filter((n) => n !== editingDessert.name) : allDessertNames}
					/>
				</DialogContent>
			</Dialog>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">{title}</h1>
					{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
					{inventory && <p className="text-sm text-muted-foreground">Today: {inventory.todayLabel}</p>}
				</div>
				<div className="flex flex-wrap gap-2">
					<ReactiveButton
						variant="outline"
						size="sm"
						isLoading={isDisablingAll}
						isError={disableAllError}
						loadingLabel="Disabling..."
						successLabel="Disabled all"
						errorLabel="Failed"
						onClick={handleDisableAll}
						disabled={inventory?.isSaving || desserts.every((d) => !d.enabled)}
					>
						Disable All
					</ReactiveButton>
					{inventory && (
						<InventorySaveButton size="sm" onClick={inventory.onSaveInventory} disabled={!inventory.hasChanges} />
					)}
					<Button
						onClick={() => {
							setEditingDessert(null);
							setOpenModal(true);
						}}
						size="sm"
					>
						Add Dessert
					</Button>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
				<Input
					placeholder="Search desserts..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full sm:max-w-xs"
				/>
				{searchTerm && (
					<Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
						Clear
					</Button>
				)}
			</div>

			{/* Enabled Desserts */}
			{enabledDesserts.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold mb-2 text-green-700">Available ({enabledDesserts.length})</h3>
					<div className="border rounded-lg overflow-hidden bg-white shadow-sm">
						<Table>
							{renderTableHeader()}
							<TableBody>
								{enabledDesserts.map((dessert, index) => (
									<DessertRow
										key={dessert.id}
										dessert={dessert}
										index={index}
										totalCount={enabledDesserts.length}
										showReorder={true}
										isMoving={movingIds.has(dessert.id)}
										inventory={inventory}
										onToggle={handleToggleDessert}
										onEdit={handleEdit}
										onMoveToTop={handleMoveToTop}
										onMoveUp={handleMoveUp}
										onMoveDown={handleMoveDown}
										onMoveToBottom={handleMoveToBottom}
									/>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Disabled Desserts */}
			{disabledDesserts.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold mb-2 text-red-700">Disabled ({disabledDesserts.length})</h3>
					<div className="border rounded-lg overflow-hidden bg-white shadow-sm opacity-80">
						<Table>
							{renderTableHeader()}
							<TableBody>
								{disabledDesserts.map((dessert, index) => (
									<DessertRow
										key={dessert.id}
										dessert={dessert}
										index={index}
										totalCount={disabledDesserts.length}
										showReorder={false}
										isMoving={movingIds.has(dessert.id)}
										inventory={inventory}
										onToggle={handleToggleDessert}
										onEdit={handleEdit}
										onMoveToTop={handleMoveToTop}
										onMoveUp={handleMoveUp}
										onMoveDown={handleMoveDown}
										onMoveToBottom={handleMoveToBottom}
									/>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Empty state */}
			{filteredDesserts.length === 0 && (
				<div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
					<p className="font-medium">
						{searchTerm ? "No desserts found matching your search." : "No desserts available."}
					</p>
					{searchTerm && (
						<Button variant="link" onClick={() => setSearchTerm("")} className="mt-1 h-auto p-0 text-sm">
							Clear search
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

type DessertRowProps = {
	dessert: Dessert;
	index: number;
	totalCount: number;
	showReorder: boolean;
	isMoving: boolean;
	inventory?: InventoryData;
	onToggle: (dessert: Dessert, controls: ReactiveButtonControls) => void;
	onEdit: (dessert: Dessert) => void;
	onMoveToTop: (dessert: Dessert) => Promise<boolean>;
	onMoveUp: (dessert: Dessert) => Promise<boolean>;
	onMoveDown: (dessert: Dessert) => Promise<boolean>;
	onMoveToBottom: (dessert: Dessert) => Promise<boolean>;
};

function DessertRow({
	dessert,
	index,
	totalCount,
	showReorder,
	isMoving,
	inventory,
	onToggle,
	onEdit,
	onMoveToTop,
	onMoveUp,
	onMoveDown,
	onMoveToBottom,
}: DessertRowProps) {
	const isChanged = inventory?.changedDessertIds.has(dessert.id) ?? false;
	const [toggleControls, ToggleButton] = useReactiveButton({
		label: dessert.enabled ? "On" : "Off",
		loading: { label: "" },
		success: { label: "", duration: 1200 },
		error: { label: "" },
		feedbackStyle: "neutral",
	});

	return (
		<TableRow
			className={cn(
				!dessert.enabled && "opacity-60 bg-muted/50",
				isMoving && "bg-primary/5",
				isChanged && "bg-yellow-50",
			)}
		>
			{/* Reorder controls */}
			<TableCell className="w-25">
				{showReorder && dessert.enabled && (
					<div className="flex items-center gap-0.5">
						<ReorderControl
							icon={ChevronsUp}
							title="Move to top"
							disabled={index === 0 || isMoving}
							onMove={() => onMoveToTop(dessert)}
						/>
						<ReorderControl
							icon={ChevronUp}
							title="Move up"
							disabled={index === 0 || isMoving}
							onMove={() => onMoveUp(dessert)}
						/>
						<ReorderControl
							icon={ChevronDown}
							title="Move down"
							disabled={index === totalCount - 1 || isMoving}
							onMove={() => onMoveDown(dessert)}
						/>
						<ReorderControl
							icon={ChevronsDown}
							title="Move to bottom"
							disabled={index === totalCount - 1 || isMoving}
							onMove={() => onMoveToBottom(dessert)}
						/>
					</div>
				)}
				{!showReorder && dessert.enabled && <span className="text-xs text-muted-foreground">#{index + 1}</span>}
			</TableCell>

			{/* Dessert name */}
			<TableCell>
				<div className="flex flex-col">
					<span className={cn("font-medium", !dessert.enabled && "line-through text-muted-foreground")}>
						{dessert.name}
						{dessert.hasUnlimitedStock && <InfinityIcon className="inline-block ml-1.5 size-4 text-blue-500" />}
					</span>
					<span className="text-xs text-muted-foreground">Rs {dessert.price}</span>
				</div>
			</TableCell>

			{/* Stock input - only show if inventory is provided */}
			{inventory && (
				<TableCell className="w-25">
					{dessert.hasUnlimitedStock ? (
						<div className="flex items-center justify-center h-8 w-20 text-blue-500">
							<InfinityIcon className="size-5" />
						</div>
					) : (
						<Input
							type="number"
							min={0}
							step={1}
							value={inventory.quantities[dessert.id] ?? "0"}
							onChange={(e) => inventory.onQuantityChange(dessert.id, e.target.value)}
							onFocus={(e) => e.target.select()}
							className={cn("h-8 w-20", isChanged && "border-yellow-400 ring-1 ring-yellow-400")}
							disabled={!dessert.enabled}
						/>
					)}
				</TableCell>
			)}

			{/* Edit button */}
			<TableCell className="w-12">
				<Button variant="ghost" size="sm" onClick={() => onEdit(dessert)} className="h-7 w-7 p-0" title="Edit dessert">
					<Pencil className="size-3" />
				</Button>
			</TableCell>

			{/* Enable/Disable toggle */}
			<TableCell className="w-20">
				<ToggleButton
					variant={dessert.enabled ? "outline" : "secondary"}
					size="sm"
					onClick={() => onToggle(dessert, toggleControls)}
					className={cn(
						"text-xs h-7 px-2",
						dessert.enabled
							? "border-green-200 text-green-700 hover:bg-green-50"
							: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
					)}
				/>
			</TableCell>
		</TableRow>
	);
}

type ReorderControlProps = {
	icon: ReactiveButtonIcon;
	title: string;
	disabled: boolean;
	onMove: () => Promise<boolean>;
};

function ReorderControl({ icon, title, disabled, onMove }: ReorderControlProps) {
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
			size="sm"
			onClick={handleClick}
			disabled={disabled}
			className="h-7 w-7 p-0"
			title={title}
		/>
	);
}
