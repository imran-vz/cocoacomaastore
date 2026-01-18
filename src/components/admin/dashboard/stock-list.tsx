import { Box } from "lucide-react";
import type { DessertStock } from "@/app/admin/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function StockList({
	stock,
	isLoading,
}: {
	stock: DessertStock[];
	isLoading?: boolean;
}) {
	const filteredStock = stock.filter((item) => item.enabled);

	return (
		<Card className="flex flex-col col-span-2">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Box className="size-5" />
					Stock Levels
				</CardTitle>
				<CardDescription>Inventory for selected date</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-100 px-6">
					{isLoading ? (
						<div className="space-y-3 pb-4">
							{[1, 2, 3, 4, 5].map((i) => (
								<Skeleton key={i} className="h-12 w-full rounded-lg" />
							))}
						</div>
					) : (
						<div className="space-y-3 pb-4">
							{filteredStock.map((item) => (
								<div
									key={item.id}
									className={cn(
										"flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50",
										!item.enabled && "opacity-50 bg-muted/50",
									)}
								>
									<div className="flex items-center gap-3">
										<div
											className={cn(
												"size-2.5 rounded-full ring-2 ring-background",
												item.hasUnlimitedStock
													? "bg-blue-500"
													: item.currentStock > 10
														? "bg-emerald-500"
														: item.currentStock > 0
															? "bg-amber-500"
															: "bg-red-500",
											)}
										/>
										<span className="font-medium text-sm">{item.name}</span>
									</div>
									<div className="flex items-center gap-2">
										{item.hasUnlimitedStock ? (
											<Badge variant="outline" className="text-xs font-normal">
												Unlimited
											</Badge>
										) : (
											<Badge
												variant={
													item.currentStock > 10
														? "secondary"
														: item.currentStock > 0
															? "outline"
															: "destructive"
												}
												className="text-xs tabular-nums min-w-12 justify-center"
											>
												{item.currentStock}
											</Badge>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
