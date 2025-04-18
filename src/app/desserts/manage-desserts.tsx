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

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		const dessertsWithSequence = desserts.map((dessert) => ({
			...dessert,
			sequence: (dessert as Dessert & { sequence: number }).sequence,
		}));
		if (active.id !== over?.id) {
			const oldIndex = desserts.findIndex((item) => item.id === active.id);
			const newIndex = desserts.findIndex((item) => item.id === over?.id);

			const newItems = arrayMove(desserts, oldIndex, newIndex);
			setDesserts(newItems);

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
		<div className="space-y-8">
			<Dialog open={openModal} onOpenChange={handleCloseModal}>
				<DialogContent className="-mt-28">
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

			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold">Desserts</h2>
				<Button
					type="button"
					onClick={() => {
						setEditingDessert(null);
						handleOpenModal();
					}}
				>
					Add Dessert
				</Button>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<div className="overflow-x-auto max-w-screen">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="min-w-24">Name</TableHead>
								<TableHead className="min-w-12">Price</TableHead>
								<TableHead className="min-w-24">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<SortableContext
							items={desserts.map((d) => d.id)}
							strategy={verticalListSortingStrategy}
						>
							<TableBody>
								{desserts.map((dessert) => (
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
			</DndContext>
		</div>
	);
}
