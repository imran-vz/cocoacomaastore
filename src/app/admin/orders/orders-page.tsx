"use client";

import { Package, User } from "lucide-react";
import { useCallback, useState } from "react";

import { DateSwitcher } from "@/components/date-switcher";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetOrdersReturnType } from "./actions";
import { getCachedOrders } from "./actions";
import { OrderCard } from "./order-card";

function formatDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function OrdersSkeleton() {
	return (
		<div className="space-y-3">
			{[1, 2, 3].map((i) => (
				<Skeleton key={i} className="h-24 rounded-lg" />
			))}
		</div>
	);
}

export default function AdminOrdersPage({
	initialOrders,
}: {
	initialOrders: GetOrdersReturnType;
}) {
	const [orders, setOrders] = useState(initialOrders);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedDate, setSelectedDate] = useState<Date>(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	});

	const handleDateChange = useCallback(async (date: Date) => {
		setSelectedDate(date);
		setIsLoading(true);

		try {
			const dateString = formatDateString(date);
			const newOrders = await getCachedOrders(dateString);
			setOrders(newOrders);
		} catch (error) {
			console.error("Failed to fetch orders:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const totalItems = orders.reduce(
		(acc, order) =>
			acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
		0,
	);

	const totalRevenue = orders.reduce(
		(acc, order) => acc + Number(order.total),
		0,
	);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Orders</h1>
					<p className="text-sm text-muted-foreground">
						View and manage orders
					</p>
				</div>
				<DateSwitcher
					selectedDate={selectedDate}
					onDateChange={handleDateChange}
				/>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-3">
				<Card className="p-3">
					<div className="flex flex-col items-center justify-center text-center">
						<Package className="size-4 text-muted-foreground mb-1" />
						{isLoading ? (
							<Skeleton className="h-7 w-8 mb-1" />
						) : (
							<p className="text-xl font-bold tabular-nums">{orders.length}</p>
						)}
						<p className="text-xs text-muted-foreground">Orders</p>
					</div>
				</Card>
				<Card className="p-3">
					<div className="flex flex-col items-center justify-center text-center">
						<User className="size-4 text-muted-foreground mb-1" />
						{isLoading ? (
							<Skeleton className="h-7 w-8 mb-1" />
						) : (
							<p className="text-xl font-bold tabular-nums">{totalItems}</p>
						)}
						<p className="text-xs text-muted-foreground">Items</p>
					</div>
				</Card>
				<Card className="p-3">
					<div className="flex flex-col items-center justify-center text-center">
						<span className="text-muted-foreground mb-1 text-sm font-medium">
							₹
						</span>
						{isLoading ? (
							<Skeleton className="h-7 w-12 mb-1" />
						) : (
							<p className="text-xl font-bold tabular-nums">
								{totalRevenue.toFixed(0)}
							</p>
						)}
						<p className="text-xs text-muted-foreground">Revenue</p>
					</div>
				</Card>
			</div>

			{/* Orders list */}
			{isLoading ? (
				<OrdersSkeleton />
			) : orders.length > 0 ? (
				<div className="space-y-3">
					{orders.map((order) => (
						<OrderCard key={order.id} order={order} />
					))}
				</div>
			) : (
				<Card className="p-8">
					<div className="flex flex-col items-center justify-center text-center text-muted-foreground">
						<Package className="size-12 mb-3 opacity-50" />
						<p className="font-medium">No orders</p>
						<p className="text-sm">No orders found for the selected date</p>
					</div>
				</Card>
			)}
		</div>
	);
}
