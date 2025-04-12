"use client";

import { CheckCircle2Icon, LoaderIcon } from "lucide-react";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getOrders, updateOrderStatus } from "./actions";
import OrderModal from "./order-modal";

export type DBOrder = {
	id: number;
	isDeleted: boolean;
	customerName: string;
	createdAt: Date;
	deliveryCost: string | null;
	total: string;
	status: "pending" | "completed";
	orderItems: {
		id: number;
		quantity: number;
		dessert: {
			id: number;
			name: string;
		};
	}[];
};

export default function OrdersPage({
	initialOrders,
}: { initialOrders: Promise<DBOrder[]> }) {
	const [orders, setOrders] = useState(use(initialOrders));
	const [openModal, setOpenModal] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			getOrders().then(setOrders);
		}, 10_000);

		return () => clearInterval(interval);
	}, []);

	const handleDone = async (orderId: number) => {
		setIsLoading(true);
		try {
			await updateOrderStatus(orderId, "completed");
			setOrders(
				orders.map((order) =>
					order.id === orderId ? { ...order, status: "completed" } : order,
				),
			);
			getOrders().then(setOrders);
			setSelectedOrder(null);
		} catch (error) {
			toast.error("Failed to update order status");
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleView = (orderId: number) => {
		setOpenModal(true);
		setSelectedOrder(orders.find((order) => order.id === orderId) || null);
	};

	return (
		<div>
			<h1 className="text-2xl font-bold mb-6">Orders</h1>
			{openModal && selectedOrder && (
				<OrderModal
					order={selectedOrder}
					onClose={() => setOpenModal(false)}
					done={() => handleDone(selectedOrder.id)}
					isLoading={isLoading}
				/>
			)}
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Customer</TableHead>
							<TableHead>Items</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{orders.map((order, index) => (
							<TableRow
								key={order.id}
								className={index % 2 === 1 ? "bg-muted" : ""}
							>
								<TableCell onClick={() => handleView(order.id)}>
									{order.customerName}
								</TableCell>
								<TableCell className="p-2 text-xs">
									{order.orderItems.reduce(
										(acc, item) => acc + item.quantity,
										0,
									)}
								</TableCell>
								<TableCell className="p-2 whitespace-nowrap">
									<Badge
										variant="outline"
										className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3"
									>
										{order.status === "completed" ? (
											<CheckCircle2Icon className="text-green-500 dark:text-green-400" />
										) : (
											<LoaderIcon />
										)}
										{order.status}
									</Badge>
								</TableCell>
								<TableCell className="p-2 whitespace-nowrap space-x-2">
									<Button
										onClick={() => handleView(order.id)}
										variant="outline"
										size="sm"
									>
										View
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
