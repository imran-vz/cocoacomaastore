"use client";

import { ProductForm } from "@/components/product-form";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	createProduct,
	deleteProduct,
	getProducts,
	updateProduct,
} from "./actions";

export default function AdminPage() {
	const [products, setProducts] = useState<Dessert[]>([]);
	const [editingProduct, setEditingProduct] = useState<Dessert | null>(null);
	const [openModal, setOpenModal] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		getProducts().then(setProducts);
	}, []);

	const handleOpenModal = () => {
		setOpenModal(true);
	};

	const handleCloseModal = () => {
		setOpenModal(false);
	};

	const handleSubmit = async (values: Omit<Dessert, "id">) => {
		setIsLoading(true);
		try {
			if (editingProduct) {
				await updateProduct(editingProduct.id, values);
			} else {
				await createProduct(values);
			}

			// Refresh products
			const updatedProducts = await getProducts();
			setProducts(updatedProducts);
			setEditingProduct(null);
			handleCloseModal();
			toast.success("Product saved successfully");
		} catch (error) {
			toast.error("Failed to save product");
			console.error("Failed to save product:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (editingProduct) {
			try {
				setIsLoading(true);
				await deleteProduct(editingProduct.id);
				const updatedProducts = await getProducts();
				setProducts(updatedProducts);
				setEditingProduct(null);
				handleCloseModal();
				toast.success("Product deleted successfully");
			} catch (error) {
				toast.error("Failed to delete product");
				console.error("Failed to delete product:", error);
			} finally {
				setIsLoading(false);
			}
		}
	};

	return (
		<main className="min-h-screen p-3 pb-6 max-w-md mx-auto">
			<div className="space-y-8">
				<Dialog open={openModal} onOpenChange={handleCloseModal}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{editingProduct ? "Edit Product" : "Add New Product"}
							</DialogTitle>
						</DialogHeader>
						<ProductForm
							key={editingProduct?.id}
							initialData={editingProduct ?? undefined}
							onSubmit={handleSubmit}
							onDelete={handleDelete}
							isLoading={isLoading}
						/>
					</DialogContent>
				</Dialog>

				<div>
					<div className="flex justify-between items-center">
						<h2 className="text-2xl font-bold mb-4">Products</h2>
						<Button
							onClick={() => {
								setEditingProduct(null);
								handleOpenModal();
							}}
						>
							Add Product
						</Button>
					</div>
					<div className="overflow-x-auto max-w-screen">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead className="min-w-[100px]">Description</TableHead>
									<TableHead>Price</TableHead>
									<TableHead>Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{products.map((product) => (
									<TableRow key={product.id}>
										<TableCell className="font-medium max-w-[130px] truncate">
											{product.name}
										</TableCell>
										<TableCell className="break-words max-w-[100px] truncate">
											{product.description}
										</TableCell>
										<TableCell>{product.price.toFixed(2)}</TableCell>
										<TableCell>
											<Button
												variant="outline"
												onClick={() => {
													setEditingProduct(product);
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
			</div>
		</main>
	);
}
