"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getOrders, updateOrderStatus } from "./actions";
import OrderModal from "./order-modal";
import { toast } from "sonner";

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
}: { initialOrders: DBOrder[] }) {
	const [orders, setOrders] = useState(initialOrders);
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
		<div className="p-4">
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
				<table className="min-w-full bg-white shadow-md rounded-lg">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-2 text-left text-xs font-medium text-slate-500 uppercase">
								Customer
							</th>
							<th className="px-2 text-left text-xs min-w-24 font-medium text-slate-500 uppercase">
								Items
							</th>
							<th className="px-2 text-left text-xs font-medium text-slate-500 uppercase">
								Status
							</th>
							<th className="pl-2 text-left text-xs font-medium text-slate-500 uppercase">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{orders.map((order) => (
							<tr key={order.id}>
								<td className="p-2 whitespace-nowrap">{order.customerName}</td>
								<td className="p-2 text-xs">
									{order.orderItems.reduce(
										(acc, item) => acc + item.quantity,
										0,
									)}{" "}
									items
								</td>
								<td className="p-2 whitespace-nowrap">
									<span
										className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
											order.status === "completed"
												? "bg-green-100 text-green-800"
												: "bg-yellow-100 text-yellow-800"
										}`}
									>
										{order.status}
									</span>
								</td>
								<td className="p-2 whitespace-nowrap space-x-2">
									<Button
										onClick={() => handleView(order.id)}
										variant="outline"
										size="sm"
									>
										View
									</Button>
									{order.status === "pending" && (
										<Button
											onClick={() => handleDone(order.id)}
											variant="default"
											size="sm"
										>
											Done
										</Button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
