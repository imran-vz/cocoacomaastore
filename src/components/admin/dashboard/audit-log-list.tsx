import { IconLink } from "@tabler/icons-react";
import { Clock } from "lucide-react";
import Link from "next/link";
import type { AuditLogEntry } from "@/app/admin/dashboard/actions";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

function formatTime(date: Date | string) {
	const d = typeof date === "string" ? new Date(date) : date;
	return d.toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Asia/Kolkata",
	});
}

export default function AuditLogList({
	logs,
	isLoading,
}: {
	logs: AuditLogEntry[];
	isLoading?: boolean;
}) {
	const getActionBadge = (
		action: AuditLogEntry["action"],
		note?: string | null,
	) => {
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
		<Card className="flex flex-col col-span-2">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Clock className="size-5" />
					Audit Log
				</CardTitle>
				<CardDescription>Inventory changes for selected date</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-100 px-6">
					{isLoading ? (
						<div className="space-y-3 pb-4">
							{[1, 2, 3, 4, 5].map((i) => (
								<Skeleton key={i} className="h-16 w-full rounded-lg" />
							))}
						</div>
					) : logs.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
							<Clock className="size-10 mb-2 opacity-50" />
							<p className="text-sm">No audit logs for this date</p>
						</div>
					) : (
						<div className="space-y-3 pb-4">
							{logs.map((log) => (
								<div
									key={log.id}
									className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
								>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-sm">
												{log.dessertName}
											</span>
											{getActionBadge(log.action, log.note)}
										</div>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span className="tabular-nums font-medium">
												{log.previousQuantity} → {log.newQuantity}
											</span>
											{log.orderId && (
												<Link
													href={`/admin/orders?orderId=${log.orderId}`}
													className="text-muted-foreground hover:underline hover:text-primary transition-colors inline-flex gap-2 underline"
												>
													Order #{log.orderId}{" "}
													<span>
														<IconLink className="size-4" />
													</span>
												</Link>
											)}
										</div>
									</div>
									<span className="text-xs text-muted-foreground whitespace-nowrap">
										{formatTime(log.createdAt)}
									</span>
								</div>
							))}
						</div>
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
