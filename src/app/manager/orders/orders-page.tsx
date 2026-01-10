"use client";

import { ChevronDown, ChevronUp, Clock, Package, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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
							<div key={item.id} className="flex flex-col gap-0.5">
								<div className="flex items-center justify-between text-sm">
									<span className="flex-1">{item.dessert.name}</span>
									<span className="text-muted-foreground font-medium tabular-nums">
										×{item.quantity}
									</span>
								</div>
								{item.modifiers && item.modifiers.length > 0 && (
									<p className="text-xs text-muted-foreground pl-2">
										+{" "}
										{item.modifiers
											.map((mod) =>
												mod.quantity > 1
													? `${mod.quantity}× ${mod.dessert.name}`
													: mod.dessert.name,
											)
											.join(", ")}
									</p>
								)}
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

export default function OrdersPage({
	initialOrders,
}: {
	initialOrders: GetOrdersReturnType;
}) {
	const [orders, setOrders] = useState(initialOrders);

	const refetch = useCallback(() => {
		getCachedOrders().then(setOrders);
	}, []);

	// Auto-refresh every 10 seconds
	useEffect(() => {
		const interval = setInterval(refetch, 10_000);
		return () => clearInterval(interval);
	}, [refetch]);

	const [todayLabel, setTodayLabel] = useState("");

	useEffect(() => {
		const date = new Date().toLocaleDateString("en-IN", {
			weekday: "long",
			day: "numeric",
			month: "long",
			timeZone: "Asia/Kolkata",
		});
		setTodayLabel(date);
	}, []);

	const totalItems = orders.reduce(
		(acc, order) =>
			acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
		0,
	);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold">Orders</h1>
				<div className="text-sm text-muted-foreground">
					{todayLabel ? todayLabel : <Skeleton className="w-24 h-4" />}
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 gap-3">
				<Card className="p-3">
					<div className="flex flex-col items-center justify-center text-center">
						<Package className="size-4 text-muted-foreground mb-1" />
						<p className="text-xl font-bold tabular-nums">{orders.length}</p>
						<p className="text-xs text-muted-foreground">Orders</p>
					</div>
				</Card>
				<Card className="p-3">
					<div className="flex flex-col items-center justify-center text-center">
						<User className="size-4 text-muted-foreground mb-1" />
						<p className="text-xl font-bold tabular-nums">{totalItems}</p>
						<p className="text-xs text-muted-foreground">Items</p>
					</div>
				</Card>
			</div>

			{/* Orders list */}
			{orders.length > 0 ? (
				<div className="space-y-3">
					{orders.map((order) => (
						<OrderCard key={order.id} order={order} />
					))}
				</div>
			) : (
				<Card className="p-8">
					<div className="flex flex-col items-center justify-center text-center text-muted-foreground">
						<Package className="size-12 mb-3 opacity-50" />
						<p className="font-medium">No orders yet</p>
						<p className="text-sm">Orders will appear here as they come in</p>
					</div>
				</Card>
			)}
		</div>
	);
}
