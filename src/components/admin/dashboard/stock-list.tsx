import { Box, CheckCircle2, InfinityIcon, PackageCheck } from "lucide-react";
import type { DessertStock } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function StockList({ stock, isLoading }: { stock: DessertStock[]; isLoading?: boolean }) {
	const filteredStock = stock.filter((item) => item.enabled);
	const finiteStock = filteredStock.filter((item) => !item.hasUnlimitedStock);
	const outOfStockCount = finiteStock.filter((item) => item.currentStock <= 0).length;
	const lowStockCount = finiteStock.filter((item) => item.currentStock > 0 && item.currentStock <= 10).length;
	const unlimitedCount = filteredStock.filter((item) => item.hasUnlimitedStock).length;
	const sortedStock = [...filteredStock].sort((a, b) => {
		if (a.hasUnlimitedStock && !b.hasUnlimitedStock) return 1;
		if (!a.hasUnlimitedStock && b.hasUnlimitedStock) return -1;
		if (a.hasUnlimitedStock && b.hasUnlimitedStock) return a.name.localeCompare(b.name);
		if (a.currentStock <= 0 && b.currentStock > 0) return 1;
		if (a.currentStock > 0 && b.currentStock <= 0) return -1;
		if (a.currentStock !== b.currentStock) return a.currentStock - b.currentStock;
		return a.name.localeCompare(b.name);
	});

	return (
		<Card className="col-span-2 flex flex-col">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Box className="size-5" />
							Stock Levels
						</CardTitle>
						<CardDescription>Inventory for selected date</CardDescription>
					</div>
					<Badge variant="outline" className="shrink-0 text-xs font-normal tabular-nums">
						{filteredStock.length} active
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex-1 px-6 pb-6 pt-0">
				<div className="mb-3 flex flex-wrap gap-2">
					<div className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-muted/20 px-3 text-xs font-medium text-muted-foreground">
						<PackageCheck className="size-3.5" />
						<span>Low</span>
						<span className="font-semibold text-foreground tabular-nums">{lowStockCount}</span>
					</div>
					<div className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-primary/5 px-3 text-xs font-medium text-primary">
						<CheckCircle2 className="size-3.5" />
						<span>Sold</span>
						<span className="font-semibold tabular-nums">{outOfStockCount}</span>
					</div>
					<div className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-muted/20 px-3 text-xs font-medium text-muted-foreground">
						<InfinityIcon className="size-3.5" />
						<span>Open</span>
						<span className="font-semibold text-foreground tabular-nums">{unlimitedCount}</span>
					</div>
				</div>
				<ScrollArea className="h-80 pr-3">
					{isLoading ? (
						<div className="overflow-hidden rounded-lg border">
							{[1, 2, 3, 4, 5].map((i) => (
								<div key={i} className="flex items-center justify-between border-b px-3 py-3 last:border-b-0">
									<div className="flex items-center gap-2">
										<Skeleton className="size-2.5 rounded-full" />
										<Skeleton className="h-4 w-40" />
									</div>
									<Skeleton className="h-6 w-14 rounded-full" />
								</div>
							))}
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border">
							{sortedStock.map((item) => {
								const status = item.hasUnlimitedStock
									? "Unlimited"
									: item.currentStock > 10
										? "Healthy"
										: item.currentStock > 0
											? "Low"
											: "Sold out";

								return (
									<div
										key={item.id}
										className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/30"
									>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span
													className={cn(
														"size-2.5 shrink-0 rounded-full",
														item.hasUnlimitedStock
															? "bg-blue-500"
															: item.currentStock > 10
																? "bg-emerald-500"
																: item.currentStock > 0
																	? "bg-amber-500"
																	: "bg-primary",
													)}
												/>
												<span className="truncate text-sm font-medium">{item.name}</span>
											</div>
											<div className="mt-0.5 text-xs text-muted-foreground">{status}</div>
										</div>
										{item.hasUnlimitedStock ? (
											<Badge variant="outline" className="shrink-0 text-xs font-normal">
												Unlimited
											</Badge>
										) : (
											<div
												className={cn(
													"grid h-7 min-w-12 place-items-center rounded-full border px-3 text-sm font-semibold tabular-nums",
													item.currentStock <= 0
														? "border-primary/20 bg-primary/10 text-primary"
														: item.currentStock <= 10
															? "border-amber-500/20 bg-amber-500/10 text-amber-700"
															: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
												)}
											>
												{item.currentStock}
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
