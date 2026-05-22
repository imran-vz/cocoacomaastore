import { IconLink } from "@tabler/icons-react";
import { Clock, History, PackageMinus, RotateCcw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { AuditLogEntry } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function formatTime(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Asia/Kolkata",
	});
}

export default function AuditLogList({ logs, isLoading }: { logs: AuditLogEntry[]; isLoading?: boolean }) {
	const orderCount = logs.filter((log) => log.action === "order_deducted").length;
	const manualCount = logs.filter((log) => log.action === "manual_adjustment" || log.action === "set_stock").length;
	const cancelledCount = logs.filter((log) => log.action === "order_cancelled").length;

	const getActionBadge = (action: AuditLogEntry["action"], note?: string | null) => {
		switch (action) {
			case "set_stock":
				return (
					<Badge variant="default" className="text-xs">
						Set Stock
					</Badge>
				);
			case "order_deducted":
				return (
					<Badge variant="secondary" className="text-xs">
						Order
					</Badge>
				);
			case "manual_adjustment":
				return (
					<Badge variant="outline" className="text-xs">
						Manual
					</Badge>
				);
			case "order_cancelled":
				return (
					<Tooltip>
						<TooltipTrigger>
							<Badge variant="destructive" className="text-xs">
								Cancelled
							</Badge>
						</TooltipTrigger>
						<TooltipContent>
							<p>{note}</p>
						</TooltipContent>
					</Tooltip>
				);
		}
	};

	return (
		<Card className="col-span-2 flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Clock className="size-5" />
							Audit Log
						</CardTitle>
						<CardDescription>Inventory changes for selected date</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 text-xs font-normal tabular-nums">
						{logs.length} events
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex-1 px-6 pb-6 pt-0">
				<div className="mb-4 grid grid-cols-3 gap-2">
					<div className="rounded-lg border bg-muted/25 px-3 py-2.5">
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<PackageMinus className="size-3.5" />
							<span className="text-xs font-medium">Orders</span>
						</div>
						<div className="mt-1 text-lg font-semibold tabular-nums">{orderCount}</div>
					</div>
					<div className="rounded-lg border bg-muted/25 px-3 py-2.5">
						<div className="flex items-center gap-1.5 text-muted-foreground">
							<SlidersHorizontal className="size-3.5" />
							<span className="text-xs font-medium">Manual</span>
						</div>
						<div className="mt-1 text-lg font-semibold tabular-nums">{manualCount}</div>
					</div>
					<div className="rounded-lg border bg-destructive/5 px-3 py-2.5">
						<div className="flex items-center gap-1.5 text-destructive">
							<RotateCcw className="size-3.5" />
							<span className="text-xs font-medium">Voids</span>
						</div>
						<div className="mt-1 text-lg font-semibold tabular-nums">{cancelledCount}</div>
					</div>
				</div>
				<ScrollArea className="h-80 pr-3">
					{isLoading ? (
						<div className="rounded-lg border">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 px-3 py-3">
									<div className="flex justify-center">
										<Skeleton className="size-3 rounded-full" />
									</div>
									<div className="space-y-2">
										<Skeleton className="h-4 w-2/3" />
										<Skeleton className="h-3 w-1/2" />
									</div>
								</div>
							))}
						</div>
					) : logs.length === 0 ? (
						<div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
							<History className="mb-2 size-10 opacity-45" />
							<p className="text-sm">No audit logs for this date</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border bg-card">
							<div>
								{logs.map((log, index) => {
									const delta = log.newQuantity - log.previousQuantity;
									const isDecrease = delta < 0;
									const isIncrease = delta > 0;
									const isLast = index === logs.length - 1;

									return (
										<div
											key={log.id}
											className="grid grid-cols-[3.5rem_minmax(0,1fr)] transition-colors hover:bg-muted/30"
										>
											<div className="relative flex justify-center px-3 py-3">
												{index > 0 && (
													<span
														className="absolute top-0 bottom-1/2 left-1/2 w-px -translate-x-1/2 bg-primary/45"
														aria-hidden="true"
													/>
												)}
												{!isLast && (
													<span
														className="absolute top-1/2 bottom-0 left-1/2 w-px -translate-x-1/2 bg-primary/45"
														aria-hidden="true"
													/>
												)}
												<span
													className={cn(
														"relative z-10 mt-1 size-3 rounded-full border-2 border-background shadow-sm",
														log.action === "order_cancelled" ? "bg-destructive" : "bg-primary",
													)}
												/>
											</div>
											<div className="min-w-0 border-l px-3 py-3">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<span className="truncate text-sm font-medium">{log.dessertName}</span>
															{getActionBadge(log.action, log.note)}
														</div>
														<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
															<span className="font-medium tabular-nums">
																{log.previousQuantity} → {log.newQuantity}
															</span>
															<span
																className={cn(
																	"tabular-nums",
																	isDecrease && "text-amber-700",
																	isIncrease && "text-emerald-700",
																)}
															>
																{delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`}
															</span>
															{log.orderId && (
																<Link
																	href={`/admin/orders?orderId=${log.orderId}`}
																	className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
																>
																	Order #{log.orderId}
																	<IconLink className="size-3.5" />
																</Link>
															)}
														</div>
													</div>
													<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
														{formatTime(log.createdAt)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
