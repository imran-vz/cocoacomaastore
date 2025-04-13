"use client";

import { use, useState } from "react";
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

	const handleSubmit = async (values: Omit<Dessert, "id">) => {
		setIsLoading(true);
		try {
			if (editingDessert) {
				await updateDessert(editingDessert.id, values);
			} else {
				await createDessert(values);
			}

			// Refresh desserts
			const updatedDesserts = await getCachedDesserts();
			setDesserts(updatedDesserts);
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
				const updatedDesserts = await getCachedDesserts();
				setDesserts(updatedDesserts);
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

	return (
		<div className="space-y-8">
			<Dialog open={openModal} onOpenChange={handleCloseModal}>
				<DialogContent className="-mt-20">
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
							<TableHead className="min-w-24">Price</TableHead>
							<TableHead className="min-w-24">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{desserts.map((dessert) => (
							<TableRow key={dessert.id}>
								<TableCell className="font-medium">{dessert.name}</TableCell>
								<TableCell>{dessert.price.toFixed(2)}</TableCell>
								<TableCell>
									<Button
										variant="outline"
										onClick={() => {
											setEditingDessert(dessert);
											handleOpenModal();
										}}
									>
										Edit
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
