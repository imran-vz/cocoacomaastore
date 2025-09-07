"use client";

import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { DessertForm } from "@/components/dessert-form";
import { DraggableTableRow } from "@/components/draggable-table-row";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Dessert } from "@/lib/types";
import {
	createDessert,
	deleteDessert,
	disableAllDesserts,
	getCachedDesserts,
	toggleDessert,
	updateDessert,
	updateDessertSequence,
} from "./actions";

export default function ManageDesserts({
	initialDesserts,
}: { initialDesserts: Promise<Dessert[]> }) {
	const initial = use(initialDesserts);

	const [desserts, setDesserts] = useState<Dessert[]>(initial);
	const [editingDessert, setEditingDessert] = useState<Dessert | null>(null);
	const [openModal, setOpenModal] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");

	const handleOpenModal = () => {
		setOpenModal(true);
	};

	const handleCloseModal = () => {
		setOpenModal(false);
	};

	const refetch = useCallback(
		() =>
			getCachedDesserts({
				shouldShowDisabled: true,
			}).then((newDesserts) => {
				setDesserts(newDesserts);
			}),
		[],
	);

	const handleSubmit = async (
		values: Omit<Dessert, "id" | "enabled" | "sequence">,
	) => {
		setIsLoading(true);
		try {
			const trimmedValues = {
				...values,
				name: values.name.trim(),
				description: values.description?.trim() || null,
			};
			if (editingDessert) {
				await updateDessert(editingDessert.id, trimmedValues);
			} else {
				await createDessert({ ...trimmedValues, enabled: true });
			}

			// Refresh desserts
			await refetch();
			setEditingDessert(null);
			handleCloseModal();
			toast.success("Dessert saved successfully");
		} catch (error) {
			toast.error("Failed to save dessert");
			console.error("Failed to save dessert:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (editingDessert) {
			try {
				setIsLoading(true);
				await deleteDessert(editingDessert.id);
				await refetch();
				setEditingDessert(null);
				handleCloseModal();
				toast.success("Dessert deleted successfully");
			} catch (error) {
				toast.error("Failed to delete dessert");
				console.error("Failed to delete dessert:", error);
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleToggleDessert = async (dessert: Dessert) => {
		try {
			setDesserts(
				desserts.map((d) =>
					d.id === dessert.id ? { ...d, enabled: !d.enabled } : d,
				),
			);
			await toggleDessert(dessert.id, !dessert.enabled);
		} catch (error) {
			toast.error("Failed to toggle dessert");
			console.error("Failed to toggle dessert:", error);
		}
		await refetch();
	};

	const handleDisableAll = async () => {
		try {
			setIsLoading(true);
			setDesserts(desserts.map((d) => ({ ...d, enabled: false })));
			await disableAllDesserts();
			await refetch();
			toast.success("All desserts disabled successfully");
		} catch (error) {
			toast.error("Failed to disable all desserts");
			console.error("Failed to disable all desserts:", error);
			await refetch();
		} finally {
			setIsLoading(false);
		}
	};

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	// Filter desserts based on search term
	const filteredDesserts = desserts.filter((dessert) =>
		dessert.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		const dessertsWithSequence = desserts.map((dessert) => ({
			...dessert,
			sequence: (dessert as Dessert & { sequence: number }).sequence,
		}));
		if (active.id !== over?.id) {
			const oldIndex = filteredDesserts.findIndex(
				(item) => item.id === active.id,
			);
			const newIndex = filteredDesserts.findIndex(
				(item) => item.id === over?.id,
			);

			const newItems = arrayMove(filteredDesserts, oldIndex, newIndex);
			// Update the main desserts array
			const updatedDesserts = desserts.map((dessert) => {
				const updatedDessert = newItems.find((item) => item.id === dessert.id);
				return updatedDessert || dessert;
			});
			setDesserts(updatedDesserts);

			try {
				// Calculate new score
				const prevScore =
					newIndex > 0 ? dessertsWithSequence[newIndex - 1].sequence : 0;
				const nextScore =
					newIndex < dessertsWithSequence.length - 1
						? dessertsWithSequence[newIndex].sequence
						: prevScore + 1000;

				const newScore = prevScore + (nextScore - prevScore) / 2;

				await updateDessertSequence(Number(active.id), newScore);
			} catch (error) {
				toast.error("Failed to update order");
				console.error("Failed to update order:", error);
				await refetch();
			}
		}
	};

	return (
		<div className="space-y-4 md:space-y-6 lg:space-y-8 p-2 sm:p-4 md:p-0">
			<Dialog open={openModal} onOpenChange={handleCloseModal}>
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
						isLoading={isLoading}
					/>
				</DialogContent>
			</Dialog>

			<div className="flex flex-col space-y-3 sm:space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0">
				<h2 className="text-xl sm:text-2xl lg:text-3xl font-bold">Desserts</h2>
				<div className="flex flex-col space-y-2 sm:flex-row sm:gap-2 sm:space-y-0 md:gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={handleDisableAll}
						disabled={isLoading || desserts.every((d) => !d.enabled)}
						className="w-full sm:w-auto text-sm"
						size="sm"
					>
						{isLoading ? "Disabling..." : "Disable All"}
					</Button>
					<Button
						type="button"
						onClick={() => {
							setEditingDessert(null);
							handleOpenModal();
						}}
						className="w-full sm:w-auto text-sm"
						size="sm"
					>
						Add Dessert
					</Button>
				</div>
			</div>

			<div className="flex flex-col space-y-2 sm:flex-row sm:gap-3 sm:items-center sm:space-y-0 md:gap-4">
				<Input
					placeholder="Search desserts by name..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full sm:flex-1 md:max-w-sm text-sm"
				/>
				{searchTerm && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setSearchTerm("")}
						className="w-full sm:w-auto text-xs"
					>
						Clear
					</Button>
				)}
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<div className="overflow-x-auto -mx-2 sm:-mx-4 md:mx-0">
					<div className="min-w-full md:min-w-0 px-2 sm:px-4 md:px-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="min-w-28 sm:min-w-32 md:min-w-24 text-xs sm:text-sm font-medium">
										Name
									</TableHead>
									<TableHead className="min-w-16 sm:min-w-20 md:min-w-12 text-xs sm:text-sm font-medium">
										Price
									</TableHead>
									<TableHead className="min-w-24 sm:min-w-28 md:min-w-24 text-xs sm:text-sm font-medium">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<SortableContext
								items={filteredDesserts.map((d) => d.id)}
								strategy={verticalListSortingStrategy}
							>
								<TableBody>
									{filteredDesserts.map((dessert) => (
										<DraggableTableRow
											key={dessert.id}
											dessert={dessert}
											onEdit={(dessert) => {
												setEditingDessert(dessert);
												handleOpenModal();
											}}
											onToggle={handleToggleDessert}
										/>
									))}
								</TableBody>
							</SortableContext>
						</Table>
					</div>
				</div>
			</DndContext>
		</div>
	);
}
