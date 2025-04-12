"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getOrders, updateOrderStatus } from "@/app/admin/actions";
import type { Order } from "@/lib/types";
import OrderModal from "./order-modal";
import { toast } from "sonner";

export default function OrdersPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [openModal, setOpenModal] = useState(false);
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		getOrders().then(setOrders);
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
		<div className="p-8">
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
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Customer
							</th>
							<th className="px-6 py-3 text-left text-xs min-w-24 font-medium text-gray-500 uppercase tracking-wider">
								Items
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Status
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{orders.map((order) => (
							<tr key={order.id}>
								<td className="px-6 py-4 whitespace-nowrap">
									{order.customerName}
								</td>
								<td className="px-6 py-4 text-xs">
									{order.items.length} items
								</td>
								<td className="px-6 py-4 whitespace-nowrap">
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
								<td className="px-6 py-4 whitespace-nowrap space-x-2">
									<Button
										onClick={() => handleView(order.id)}
										variant="outline"
										size="sm"
									>
										View
									</Button>
									<Button
										onClick={() => handleDone(order.id)}
										variant="default"
										size="sm"
										disabled={order.status === "completed"}
									>
										Done
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
