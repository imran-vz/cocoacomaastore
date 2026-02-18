"use client";

import {
	ChevronDown,
	ChevronsDown,
	ChevronsUp,
	ChevronUp,
	Infinity as InfinityIcon,
	Pencil,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<number>>(
		new Set(),
	);
	const [movingIds, setMovingIds] = useState<Set<number>>(new Set());
	const [searchTerm, setSearchTerm] = useState("");
	const [openModal, setOpenModal] = useState(false);
	const [isFormLoading, setIsFormLoading] = useState(false);
	const [editingDessert, setEditingDessert] = useState<Dessert | null>(null);

	const filteredDesserts = desserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const enabledDesserts = filteredDesserts.filter((d) => d.enabled);
	const disabledDesserts = filteredDesserts.filter((d) => !d.enabled);

	const handleToggleDessert = async (dessert: Dessert) => {
		const newEnabledState = !dessert.enabled;
		setToggleLoadingIds((prev) => new Set(prev).add(dessert.id));
		setDesserts((prev) =>
			prev.map((d) =>
				d.id === dessert.id ? { ...d, enabled: newEnabledState } : d,
			),
		);

		try {
			await toggleDessert(dessert.id, newEnabledState);
			toast.success(
				`${dessert.name} ${newEnabledState ? "enabled" : "disabled"}`,
			);
		} catch (error) {
			toast.error("Failed to toggle dessert");
			console.error(error);
			setDesserts((prev) =>
				prev.map((d) =>
					d.id === dessert.id ? { ...d, enabled: dessert.enabled } : d,
				),
			);
		} finally {
			setToggleLoadingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
			await onRefetch();
		}
	};

	const handleDisableAll = async () => {
		try {
			setIsDisablingAll(true);
			setDesserts((prev) => prev.map((d) => ({ ...d, enabled: false })));
			await disableAllDesserts();
			await onRefetch();
			toast.success("All desserts disabled");
		} catch (error) {
			toast.error("Failed to disable all desserts");
			console.error(error);
			await onRefetch();
		} finally {
			setIsDisablingAll(false);
		}
	};

	const handleMoveUp = async (dessert: Dessert) => {
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex <= 0) return;
		const targetDessert = enabledDesserts[currentIndex - 1];
		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id)
						return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id)
						return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);
			await onRefetch();
		} catch (error) {
			toast.error("Failed to move dessert");
			console.error(error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveDown = async (dessert: Dessert) => {
		const currentIndex = enabledDesserts.findIndex((d) => d.id === dessert.id);
		if (currentIndex >= enabledDesserts.length - 1) return;
		const targetDessert = enabledDesserts[currentIndex + 1];
		setMovingIds((prev) => new Set(prev).add(dessert.id));

		try {
			await updateDessertSequence(dessert.id, targetDessert.sequence);
			await updateDessertSequence(targetDessert.id, dessert.sequence);
			setDesserts((prev) =>
				prev.map((d) => {
					if (d.id === dessert.id)
						return { ...d, sequence: targetDessert.sequence };
					if (d.id === targetDessert.id)
						return { ...d, sequence: dessert.sequence };
					return d;
				}),
			);
			await onRefetch();
		} catch (error) {
			toast.error("Failed to move dessert");
			console.error(error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToTop = async (dessert: Dessert) => {
		if (!dessert.enabled) return;
		setMovingIds((prev) => new Set(prev).add(dessert.id));
		try {
			await moveDessertToTop(dessert.id);
			await onRefetch();
		} catch (error) {
			toast.error("Failed to move dessert to top");
			console.error(error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleMoveToBottom = async (dessert: Dessert) => {
		if (!dessert.enabled) return;
		setMovingIds((prev) => new Set(prev).add(dessert.id));
		try {
			await moveDessertToBottom(dessert.id);
			await onRefetch();
		} catch (error) {
			toast.error("Failed to move dessert to bottom");
			console.error(error);
		} finally {
			setMovingIds((prev) => {
				const newSet = new Set(prev);
				newSet.delete(dessert.id);
				return newSet;
			});
		}
	};

	const handleSubmit = async (
		values: Omit<Dessert, "id" | "enabled" | "sequence" | "isDeleted">,
	) => {
		setIsFormLoading(true);
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
			setEditingDessert(null);
			setOpenModal(false);
			toast.success(
				`Dessert ${editingDessert ? "updated" : "added"} successfully`,
			);
		} catch (error) {
			toast.error(`Failed to ${editingDessert ? "update" : "add"} dessert`);
			console.error("Failed to save dessert:", error);
		} finally {
			setIsFormLoading(false);
		}
	};

	const handleDelete = async () => {
		if (editingDessert) {
			try {
				setIsFormLoading(true);
				await deleteDessert(editingDessert.id);
				await onRefetch();
				setEditingDessert(null);
				setOpenModal(false);
				toast.success("Dessert deleted successfully");
			} catch (error) {
				toast.error("Failed to delete dessert");
				console.error("Failed to delete dessert:", error);
			} finally {
				setIsFormLoading(false);
			}
		}
	};

	const renderDessertRow = (
		dessert: Dessert,
		index: number,
		totalCount: number,
		showReorder: boolean,
	) => {
		const isMoving = movingIds.has(dessert.id);
		const isToggling = toggleLoadingIds.has(dessert.id);
		const isChanged = inventory?.changedDessertIds.has(dessert.id) ?? false;

		return (
			<TableRow
				key={dessert.id}
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
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleMoveToTop(dessert)}
								disabled={index === 0 || isMoving}
								className="h-7 w-7 p-0"
								title="Move to top"
							>
								{isMoving ? (
									<Spinner className="size-3" />
								) : (
									<ChevronsUp className="size-3" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleMoveUp(dessert)}
								disabled={index === 0 || isMoving}
								className="h-7 w-7 p-0"
								title="Move up"
							>
								<ChevronUp className="size-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleMoveDown(dessert)}
								disabled={index === totalCount - 1 || isMoving}
								className="h-7 w-7 p-0"
								title="Move down"
							>
								<ChevronDown className="size-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => handleMoveToBottom(dessert)}
								disabled={index === totalCount - 1 || isMoving}
								className="h-7 w-7 p-0"
								title="Move to bottom"
							>
								<ChevronsDown className="size-3" />
							</Button>
						</div>
					)}
					{!showReorder && dessert.enabled && (
						<span className="text-xs text-muted-foreground">#{index + 1}</span>
					)}
				</TableCell>

				{/* Dessert name */}
				<TableCell>
					<div className="flex flex-col">
						<span
							className={cn(
								"font-medium",
								!dessert.enabled && "line-through text-muted-foreground",
							)}
						>
							{dessert.name}
							{dessert.hasUnlimitedStock && (
								<InfinityIcon className="inline-block ml-1.5 size-4 text-blue-500" />
							)}
						</span>
						<span className="text-xs text-muted-foreground">
							Rs {dessert.price}
						</span>
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
								onChange={(e) =>
									inventory.onQuantityChange(dessert.id, e.target.value)
								}
								onFocus={(e) => e.target.select()}
								className={cn(
									"h-8 w-20",
									isChanged && "border-yellow-400 ring-1 ring-yellow-400",
								)}
								disabled={!dessert.enabled}
							/>
						)}
					</TableCell>
				)}

				{/* Edit button */}
				<TableCell className="w-12">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setEditingDessert(dessert);
							setOpenModal(true);
						}}
						className="h-7 w-7 p-0"
						title="Edit dessert"
					>
						<Pencil className="size-3" />
					</Button>
				</TableCell>

				{/* Enable/Disable toggle */}
				<TableCell className="w-20">
					<Button
						variant={dessert.enabled ? "outline" : "secondary"}
						size="sm"
						onClick={() => handleToggleDessert(dessert)}
						disabled={isToggling}
						className={cn(
							"text-xs h-7 px-2",
							dessert.enabled
								? "border-green-200 text-green-700 hover:bg-green-50"
								: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
						)}
					>
						{isToggling ? (
							<Spinner className="size-3" />
						) : dessert.enabled ? (
							"On"
						) : (
							"Off"
						)}
					</Button>
				</TableCell>
			</TableRow>
		);
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
					setOpenModal(open);
					if (!open) setEditingDessert(null);
				}}
			>
				<DialogContent className="mx-2 max-w-[calc(100vw-1rem)] sm:mx-4 sm:max-w-[calc(100vw-2rem)] md:max-w-lg md:mx-0 md:-mt-28">
					<DialogHeader>
						<DialogTitle>
							{editingDessert ? "Edit Dessert" : "Add New Dessert"}
						</DialogTitle>
					</DialogHeader>
					<DessertForm
						key={editingDessert?.id}
						initialData={editingDessert ?? undefined}
						onSubmit={handleSubmit}
						onDelete={handleDelete}
						isLoading={isFormLoading}
					/>
				</DialogContent>
			</Dialog>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-bold">{title}</h1>
					{subtitle && (
						<p className="text-sm text-muted-foreground">{subtitle}</p>
					)}
					{inventory && (
						<p className="text-sm text-muted-foreground">
							Today: {inventory.todayLabel}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						onClick={handleDisableAll}
						disabled={
							isDisablingAll ||
							inventory?.isSaving ||
							desserts.every((d) => !d.enabled)
						}
						size="sm"
					>
						{isDisablingAll ? <Spinner className="mr-2" /> : null}
						Disable All
					</Button>
					{inventory && (
						<Button
							onClick={inventory.onSaveInventory}
							disabled={inventory.isSaving || !inventory.hasChanges}
							size="sm"
							className={cn(inventory.hasChanges && "animate-pulse")}
						>
							{inventory.isSaving ? <Spinner className="mr-2" /> : null}
							Save Stock
							{inventory.hasChanges && (
								<span className="ml-1.5 bg-yellow-200 text-yellow-800 text-xs px-1.5 py-0.5 rounded-full">
									{inventory.changedDessertIds.size}
								</span>
							)}
						</Button>
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
					<h3 className="text-sm font-semibold mb-2 text-green-700">
						Available ({enabledDesserts.length})
					</h3>
					<div className="border rounded-lg overflow-hidden bg-white shadow-sm">
						<Table>
							{renderTableHeader()}
							<TableBody>
								{enabledDesserts.map((dessert, index) =>
									renderDessertRow(
										dessert,
										index,
										enabledDesserts.length,
										true,
									),
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Disabled Desserts */}
			{disabledDesserts.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold mb-2 text-red-700">
						Disabled ({disabledDesserts.length})
					</h3>
					<div className="border rounded-lg overflow-hidden bg-white shadow-sm opacity-80">
						<Table>
							{renderTableHeader()}
							<TableBody>
								{disabledDesserts.map((dessert, index) =>
									renderDessertRow(
										dessert,
										index,
										disabledDesserts.length,
										false,
									),
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			)}

			{/* Empty state */}
			{filteredDesserts.length === 0 && (
				<div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
					<p className="font-medium">
						{searchTerm
							? "No desserts found matching your search."
							: "No desserts available."}
					</p>
					{searchTerm && (
						<Button
							variant="link"
							onClick={() => setSearchTerm("")}
							className="mt-1 h-auto p-0 text-sm"
						>
							Clear search
						</Button>
					)}
				</div>
			)}
		</div>
	);
}
