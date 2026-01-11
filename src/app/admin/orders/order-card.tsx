"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { GetOrdersReturnType } from "./actions";

function formatTime(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Asia/Kolkata",
	});
}

export function OrderCard({ order }: { order: GetOrdersReturnType[number] }) {
	const [isExpanded, setIsExpanded] = useState(false);

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

	return (
		<Card
			className={cn(
				"transition-all duration-200 border-l-4",
				isExpanded ? "border-l-primary shadow-md" : "border-l-transparent",
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
							<span className="font-bold text-lg">₹{order.total}</span>
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
						</div>
					</div>
				)}
			</div>
		</Card>
	);
}
