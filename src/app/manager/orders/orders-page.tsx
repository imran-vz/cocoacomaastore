"use client";

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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
	cancelOrder,
	type GetOrdersReturnType,
	getCachedOrders,
} from "./actions";

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
	onOrderCancelled,
}: {
	order: GetOrdersReturnType[number];
	onOrderCancelled: () => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
	const [cancelReason, setCancelReason] = useState("");
	const [isCancelling, setIsCancelling] = useState(false);

	const handleCancelOrder = async () => {
		setIsCancelling(true);
		try {
			await cancelOrder(order.id, cancelReason.trim() || undefined);
			toast.success(`Order #${order.id} has been cancelled`);
			setIsCancelDialogOpen(false);
			setCancelReason("");
			onOrderCancelled();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to cancel order",
			);
		} finally {
			setIsCancelling(false);
		}
	};

	const totalItems = order.orderItems.reduce(
		(acc, item) => acc + item.quantity,
		0,
	);

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
				"transition-all duration-200 border-l-4",
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
					className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
					onClick={() => setIsExpanded(!isExpanded)}
					onKeyUp={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							setIsExpanded(!isExpanded);
						}
					}}
					tabIndex={0}
					role="button"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
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

							<h3 className="font-semibold text-lg truncate">
								{order.customerName || "Walk-in Customer"}
							</h3>

							{!isExpanded && (
								<p className="text-sm text-muted-foreground mt-1 line-clamp-1">
									{itemsSummary}
								</p>
							)}
						</div>

						<div className="flex flex-col items-end gap-1">
							<span
								className={cn(
									"font-bold text-lg",
									isCancelled && "line-through",
								)}
							>
								₹{order.total}
							</span>
							<Badge variant="secondary" className="text-xs">
								{totalItems} item{totalItems !== 1 ? "s" : ""}
							</Badge>
						</div>
					</div>
				</div>

				{isExpanded && (
					<div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
						<Separator className="my-3" />

						<div className="space-y-3">
							<div className="rounded-md border bg-card">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="h-9">Item</TableHead>
											<TableHead className="h-9 text-right w-20">Qty</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{order.orderItems.map((item) => (
											<TableRow
												key={`${order.id}-${item.id}`} // Using composite key for safety
												className="hover:bg-transparent"
											>
												<TableCell className="py-2">
													<div className="font-medium">
														{item.comboName ? (
															<span className="text-primary">
																{item.comboName}
															</span>
														) : (
															item.dessert.name
														)}
													</div>
													{item.comboName && (
														<div className="text-xs text-muted-foreground mt-1 ml-2 pl-2 border-l-2">
															<div className="font-medium text-foreground/80">
																{item.dessert.name}
															</div>
															{item.modifiers.map((mod) => (
																<div key={`${item.id}-mod-${mod.id}`}>
																	{mod.dessert.name}
																</div>
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
												<TableCell className="text-right py-2 font-mono">
													×{item.quantity}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{order.deliveryCost && Number(order.deliveryCost) > 0 && (
								<div className="flex items-center justify-between text-sm px-2">
									<span className="text-muted-foreground">Delivery Cost</span>
									<span className="font-medium">₹{order.deliveryCost}</span>
								</div>
							)}

							{/* Cancel Order Button */}
							{!isCancelled && (
								<div className="pt-3 border-t mt-3">
									<Dialog
										open={isCancelDialogOpen}
										onOpenChange={setIsCancelDialogOpen}
									>
										<DialogTrigger asChild>
											<Button
												variant="destructive"
												size="sm"
												className="w-full"
											>
												<XCircle className="size-4 mr-2" />
												Cancel Order
											</Button>
										</DialogTrigger>
										<DialogContent>
											<DialogHeader>
												<DialogTitle>Cancel Order #{order.id}</DialogTitle>
												<DialogDescription>
													Are you sure you want to cancel this order? The
													inventory will be restored automatically.
												</DialogDescription>
											</DialogHeader>
											<div className="space-y-4 py-4">
												<div className="space-y-2">
													<Label htmlFor="cancel-reason">
														Reason (optional)
													</Label>
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
												<DialogClose asChild>
													<Button variant="outline" disabled={isCancelling}>
														Keep Order
													</Button>
												</DialogClose>
												<Button
													variant="destructive"
													onClick={handleCancelOrder}
													disabled={isCancelling}
												>
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

export default function OrdersPage({
	initialOrders,
}: {
	initialOrders: GetOrdersReturnType;
}) {
	const [orders, setOrders] = useState(initialOrders);
	const [isLoading, setIsLoading] = useState(false);

	const refetch = useCallback(() => {
		setIsLoading(true);
		getCachedOrders()
			.then(setOrders)
			.finally(() => setIsLoading(false));
	}, []);

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
		<div className="space-y-6 max-w-3xl mx-auto">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Orders</h1>
					<p className="text-muted-foreground mt-1">
						{todayLabel ? todayLabel : <Skeleton className="w-32 h-5" />}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={refetch}
					disabled={isLoading}
					className={isLoading ? "animate-pulse" : ""}
				>
					{isLoading ? "Refreshing..." : "Refresh Orders"}
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-2 gap-4">
				<Card className="p-0 gap-1">
					<CardHeader className="p-4 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Orders
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-0">
						<div className="text-2xl font-bold">{orders.length}</div>
					</CardContent>
				</Card>
				<Card className="p-0 gap-1">
					<CardHeader className="p-4 pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Items Sold
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-0">
						<div className="text-2xl font-bold">{totalItems}</div>
					</CardContent>
				</Card>
			</div>

			{/* Orders List */}
			<div className="space-y-4">
				{orders.length > 0 ? (
					orders.map((order) => (
						<OrderCard
							key={order.id}
							order={order}
							onOrderCancelled={refetch}
						/>
					))
				) : (
					<Card className="py-12 border-dashed">
						<div className="flex flex-col items-center justify-center text-center text-muted-foreground">
							<div className="bg-muted rounded-full p-4 mb-4">
								<Package className="size-8 opacity-50" />
							</div>
							<h3 className="font-semibold text-lg text-foreground">
								No orders yet
							</h3>
							<p className="text-sm max-w-62.5 mt-1">
								Orders will appear here automatically when customers make a
								purchase.
							</p>
						</div>
					</Card>
				)}
			</div>
		</div>
	);
}
