"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Package, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { cancelOrder, type GetOrdersReturnType } from "./actions";

function formatTime(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Asia/Kolkata",
	});
}

const CANCELLATION_REASONS = [
	"Customer requested cancellation",
	"Out of stock",
	"Duplicate order",
	"Wrong order placed",
	"Payment issue",
];
function OrderCard({
	order,
	onCancelOrder,
}: {
	order: GetOrdersReturnType[number];
	onCancelOrder: (orderId: number, reason?: string) => Promise<void>;
}) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
	const [cancelReason, setCancelReason] = useState("");
	const [isCancelling, setIsCancelling] = useState(false);

	const handleCancelOrder = async () => {
		setIsCancelling(true);
		try {
			await onCancelOrder(order.id, cancelReason.trim() || undefined);
			toast.success(`Order #${order.id} has been cancelled`);
			setIsCancelDialogOpen(false);
			setCancelReason("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to cancel order");
		} finally {
			setIsCancelling(false);
		}
	};

	const totalItems = order.orderItems.reduce((acc, item) => acc + item.quantity, 0);

	const itemsSummary = order.orderItems
		.map((item) => {
			if (item.comboName) {
				return `${item.comboName}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
			}
			return `${item.dessert.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
		})
		.join(", ");

	const isCancelled = order.status === "cancelled";

	return (
		<Card
			className={cn(
				"transition-all duration-200 border-l-4 py-0",
				isCancelled
					? "border-l-destructive/50 opacity-60"
					: isExpanded
						? "border-l-primary shadow-md"
						: "border-l-transparent",
			)}
		>
			<div className="flex flex-col">
				{/** biome-ignore lint/a11y/useSemanticElements: for accessibility */}
				<div
					className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={() => setIsExpanded(!isExpanded)}
					onKeyUp={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							setIsExpanded(!isExpanded);
						}
					}}
					tabIndex={0}
					role="button"
				>
					<div className="flex items-start justify-between gap-2">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-1.5 mb-1">
								<Badge variant="outline" className="font-mono text-xs">
									#{order.id}
								</Badge>
								{isCancelled && (
									<Badge variant="destructive" className="text-xs">
										Cancelled
									</Badge>
								)}
								<span className="text-xs text-muted-foreground flex items-center gap-1">
									<Clock className="size-3" />
									{formatTime(order.createdAt)}
								</span>
							</div>

							<h3 className="font-semibold text-base truncate">{order.customerName || "Walk-in Customer"}</h3>

							{!isExpanded && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{itemsSummary}</p>}
						</div>

						<div className="flex flex-col items-end gap-1 shrink-0">
							<span className={cn("font-bold text-base", isCancelled && "line-through")}>₹{order.total}</span>
							<Badge variant="secondary" className="text-xs">
								{totalItems} item{totalItems !== 1 ? "s" : ""}
							</Badge>
						</div>
					</div>
				</div>

				{isExpanded && (
					<div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
						<Separator className="my-2" />

						<div className="space-y-2">
							<div className="rounded-md border bg-card">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="h-8">Item</TableHead>
											<TableHead className="h-8 text-right w-16">Qty</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{order.orderItems.map((item) => (
											<TableRow
												key={`${order.id}-${item.id}`} // Using composite key for safety
												className="hover:bg-transparent"
											>
												<TableCell className="py-1.5">
													<div className="font-medium">
														{item.comboName ? (
															<span className="text-primary">{item.comboName}</span>
														) : (
															item.dessert.name
														)}
													</div>
													{item.comboName && (
														<div className="text-xs text-muted-foreground mt-1 ml-2 pl-2 border-l-2">
															<div className="font-medium text-foreground/80">{item.dessert.name}</div>
															{item.modifiers.map((mod) => (
																<div key={`${item.id}-mod-${mod.id}`}>{mod.dessert.name}</div>
															))}
														</div>
													)}
													{!item.comboName && item.modifiers.length > 0 && (
														<div className="text-xs text-muted-foreground mt-1 ml-2 pl-2 border-l-2">
															{item.modifiers.map((mod) => (
																<div key={`${item.id}-mod-${mod.id}`}>
																	{mod.dessert.name} ×{mod.quantity}
																</div>
															))}
														</div>
													)}
												</TableCell>
												<TableCell className="text-right py-1.5 font-mono">×{item.quantity}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{order.deliveryCost && Number(order.deliveryCost) > 0 && (
								<div className="flex items-center justify-between text-sm px-1">
									<span className="text-muted-foreground">Delivery Cost</span>
									<span className="font-medium">₹{order.deliveryCost}</span>
								</div>
							)}

							{/* Cancel Order Button */}
							{!isCancelled && (
								<div className="pt-2 mt-2">
									<Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
										<DialogTrigger
											render={
												<Button variant="destructive" size="sm" className="w-full">
													<XCircle className="size-4 mr-2" />
													Cancel Order
												</Button>
											}
										/>

										<DialogContent>
											<DialogHeader>
												<DialogTitle>Cancel Order #{order.id}</DialogTitle>
												<DialogDescription>
													Are you sure you want to cancel this order? The inventory will be restored automatically.
												</DialogDescription>
											</DialogHeader>
											<div className="space-y-4 py-4">
												<div className="space-y-2">
													<Label htmlFor="cancel-reason">Reason (optional)</Label>
													<Input
														id="cancel-reason"
														list="cancel-reasons"
														placeholder="Select or type a reason..."
														value={cancelReason}
														onChange={(e) => setCancelReason(e.target.value)}
														disabled={isCancelling}
													/>
													<datalist id="cancel-reasons">
														{CANCELLATION_REASONS.map((reason) => (
															<option key={reason} value={reason} />
														))}
													</datalist>
												</div>
											</div>
											<DialogFooter>
												<DialogClose
													render={
														<Button variant="outline" disabled={isCancelling}>
															Keep Order
														</Button>
													}
												/>
												<Button variant="destructive" onClick={handleCancelOrder} disabled={isCancelling}>
													{isCancelling ? (
														<>
															<Spinner className="size-4 mr-2" />
															Cancelling...
														</>
													) : (
														"Cancel Order"
													)}
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}

async function fetchManagerOrders(signal?: AbortSignal): Promise<GetOrdersReturnType> {
	const response = await fetch("/api/manager/orders", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch manager orders (${response.status})`);
	}

	return response.json();
}

export default function OrdersPage({ initialOrders }: { initialOrders: GetOrdersReturnType }) {
	const queryClient = useQueryClient();
	const {
		data: orders,
		error,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["manager-orders", "today"],
		queryFn: ({ signal }) => fetchManagerOrders(signal),
		initialData: initialOrders,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});
	const cancelOrderMutation = useMutation({
		mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) => cancelOrder(orderId, reason),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["manager-orders", "today"] });
		},
	});

	const refreshOrders = useCallback(() => {
		refetch();
	}, [refetch]);

	const cancelOrderWithInvalidation = useCallback(
		async (orderId: number, reason?: string) => {
			await cancelOrderMutation.mutateAsync({ orderId, reason });
		},
		[cancelOrderMutation],
	);

	if (error) {
		console.error("Failed to fetch manager orders:", error);
	}

	const isLoading = isFetching || cancelOrderMutation.isPending;

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
		(acc, order) => acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
		0,
	);

	return (
		<div className="space-y-3 max-w-3xl mx-auto">
			{/* Header */}
			<div>
				<div className="flex items-center justify-between gap-3">
					<h1 className="text-2xl font-bold tracking-tight">Orders</h1>
					<Button
						variant="outline"
						size="sm"
						onClick={refreshOrders}
						disabled={isLoading}
						className={cn("h-8", isLoading && "animate-pulse")}
					>
						{isLoading ? "Refreshing..." : "Refresh Orders"}
					</Button>
				</div>
				<p className="text-sm text-muted-foreground mt-0.5">
					{todayLabel ? todayLabel : <Skeleton className="w-32 h-4" />}
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-2 gap-2">
				<Card className="p-0 gap-0">
					<CardHeader className="p-3 pb-1">
						<CardTitle className="text-xs font-medium text-muted-foreground">Total Orders</CardTitle>
					</CardHeader>
					<CardContent className="p-3 pt-0">
						<div className="text-xl font-bold">{orders.length}</div>
					</CardContent>
				</Card>
				<Card className="p-0 gap-0">
					<CardHeader className="p-3 pb-1">
						<CardTitle className="text-xs font-medium text-muted-foreground">Items Sold</CardTitle>
					</CardHeader>
					<CardContent className="p-3 pt-0">
						<div className="text-xl font-bold">{totalItems}</div>
					</CardContent>
				</Card>
			</div>

			{/* Orders List */}
			<div className="space-y-2.5">
				{orders.length > 0 ? (
					orders.map((order) => <OrderCard key={order.id} order={order} onCancelOrder={cancelOrderWithInvalidation} />)
				) : (
					<Card className="py-8 border-dashed">
						<div className="flex flex-col items-center justify-center text-center text-muted-foreground">
							<div className="bg-muted rounded-full p-3 mb-3">
								<Package className="size-8 opacity-50" />
							</div>
							<h3 className="font-semibold text-lg text-foreground">No orders yet</h3>
							<p className="text-sm max-w-62.5 mt-1">
								Orders will appear here automatically when customers make a purchase.
							</p>
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}
