"use client";

import { use, useCallback, useState } from "react";
import { toast } from "sonner";

import { DessertForm } from "@/components/dessert-form";
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
	TableCell,
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
} from "./actions";

export default function ManageDesserts({
	initialDesserts,
}: { initialDesserts: Promise<Dessert[]> }) {
	const [desserts, setDesserts] = useState<Dessert[]>(use(initialDesserts));
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
			}).then(setDesserts),
		[],
	);

	const handleSubmit = async (values: Omit<Dessert, "id" | "enabled">) => {
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

			<div className="overflow-x-auto max-w-screen">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="min-w-24">Name</TableHead>
							<TableHead className="min-w-12">Price</TableHead>
							<TableHead className="min-w-24">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{desserts.map((dessert) => (
							<TableRow key={dessert.id}>
								<TableCell className="font-medium">{dessert.name}</TableCell>
								<TableCell>{dessert.price.toFixed(2)}</TableCell>
								<TableCell className="flex gap-2">
									<Button
										variant="outline"
										onClick={() => {
											setEditingDessert(dessert);
											handleOpenModal();
										}}
									>
										Edit
									</Button>

									<Button
										variant="outline"
										onClick={() => handleToggleDessert(dessert)}
									>
										{dessert.enabled ? "Disable" : "Enable"}
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
