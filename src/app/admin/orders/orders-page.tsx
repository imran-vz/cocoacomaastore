"use client";

import { ChevronDown, ChevronUp, Clock, Package, User } from "lucide-react";
import { useCallback, useState } from "react";

import { DateSwitcher } from "@/components/date-switcher";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type GetOrdersReturnType, getCachedOrders } from "./actions";

function formatDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatTime(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Asia/Kolkata",
	});
}

function formatDate(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		timeZone: "Asia/Kolkata",
	});
}

function OrderCard({ order }: { order: GetOrdersReturnType[number] }) {
	const [isExpanded, setIsExpanded] = useState(false);

	const totalItems = order.orderItems.reduce(
		(acc, item) => acc + item.quantity,
		0,
	);

	const itemsSummary = order.orderItems
		.map(
			(item) =>
				`${item.dessert.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
		)
		.join(", ");

	return (
		<Card
			className={cn(
				"transition-all duration-200 active:scale-[0.99]",
				isExpanded && "ring-2 ring-primary/20",
			)}
		>
			<CardHeader
				className="p-4 pb-2 cursor-pointer"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<CardTitle className="text-base font-semibold flex items-center gap-2">
							<span className="text-muted-foreground text-sm font-normal">
								#{order.id}
							</span>
							{order.customerName && (
								<>
									<span className="text-muted-foreground">•</span>
									<span className="truncate">{order.customerName}</span>
								</>
							)}
						</CardTitle>
						<CardDescription
							className="mt-1 flex items-center gap-1.5 text-xs"
							suppressHydrationWarning
						>
							<Clock className="size-3" />
							{formatTime(order.createdAt)}
							<span className="text-muted-foreground/50">•</span>
							{formatDate(order.createdAt)}
						</CardDescription>
					</div>
					<div className="flex items-center gap-2">
						<div className="text-right">
							<p className="font-semibold text-base">₹{order.total}</p>
							<p className="text-xs text-muted-foreground">
								{totalItems} item{totalItems !== 1 ? "s" : ""}
							</p>
						</div>
						<Button variant="ghost" size="icon" className="size-8 shrink-0">
							{isExpanded ? (
								<ChevronUp className="size-4" />
							) : (
								<ChevronDown className="size-4" />
							)}
						</Button>
					</div>
				</div>

				{/* Collapsed summary */}
				{!isExpanded && (
					<p className="text-xs text-muted-foreground mt-2 line-clamp-1">
						{itemsSummary}
					</p>
				)}
			</CardHeader>

			{/* Expanded content */}
			{isExpanded && (
				<CardContent className="p-4 pt-0">
					<Separator className="mb-3" />

					<div className="space-y-2">
						{order.orderItems.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between text-sm"
							>
								<span className="flex-1">{item.dessert.name}</span>
								<span className="text-muted-foreground font-medium tabular-nums">
									×{item.quantity}
								</span>
							</div>
						))}
					</div>

					{order.deliveryCost && Number(order.deliveryCost) > 0 && (
						<>
							<Separator className="my-3" />
							<div className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground">Delivery</span>
								<span className="font-medium">₹{order.deliveryCost}</span>
							</div>
						</>
					)}
				</CardContent>
			)}
		</Card>
	);
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
