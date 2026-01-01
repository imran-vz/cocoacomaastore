"use client";

import {
	ArrowDownRight,
	ArrowUpRight,
	Box,
	Clock,
	IndianRupee,
	Package,
	ShoppingCart,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
	AuditLogEntry,
	DailyRevenue,
	DashboardStats,
	DessertStock,
} from "./actions";

type DashboardContentProps = {
	stats: DashboardStats;
	stock: DessertStock[];
	auditLogs: AuditLogEntry[];
	dailyRevenue: DailyRevenue[];
};

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
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

function StatCard({
	title,
	value,
	subtitle,
	icon: Icon,
	trend,
	className,
}: {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: React.ElementType;
	trend?: "up" | "down" | "neutral";
	className?: string;
}) {
	return (
		<Card className={cn("relative overflow-hidden", className)}>
			<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{title}
				</CardTitle>
				<div className="p-2 rounded-lg bg-primary/10">
					<Icon className="size-4 text-primary" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold">{value}</div>
				{subtitle && (
					<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
						{trend === "up" && (
							<ArrowUpRight className="size-3 text-green-500" />
						)}
						{trend === "down" && (
							<ArrowDownRight className="size-3 text-red-500" />
						)}
						{subtitle}
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function RevenueChart({ data }: { data: DailyRevenue[] }) {
	const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<TrendingUp className="size-5" />
					Revenue Trend
				</CardTitle>
				<CardDescription>Last 7 days revenue</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-end justify-between gap-2 h-40">
					{data.map((day) => {
						const height = (day.revenue / maxRevenue) * 100;
						return (
							<div
								key={day.date}
								className="flex flex-col items-center gap-2 flex-1"
							>
								<div className="text-xs font-medium text-muted-foreground">
									{day.revenue > 0 ? formatCurrency(day.revenue) : "-"}
								</div>
								<div
									className="w-full bg-primary/20 rounded-t-md relative transition-all duration-300 hover:bg-primary/30"
									style={{ height: `${Math.max(height, 4)}%` }}
								>
									<div
										className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md transition-all duration-300"
										style={{ height: `${height}%` }}
									/>
								</div>
								<div className="text-xs text-muted-foreground font-medium">
									{day.date}
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function StockList({ stock }: { stock: DessertStock[] }) {
	const filteredStock = stock.filter((item) => item.enabled);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Box className="size-5" />
					Stock Levels
				</CardTitle>
				<CardDescription>Current inventory per dessert</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-75 px-6">
					<div className="space-y-3 pb-4">
						{filteredStock.map((item) => (
							<div
								key={item.id}
								className={cn(
									"flex items-center justify-between p-3 rounded-lg border transition-colors",
									!item.enabled && "opacity-50 bg-muted/50",
								)}
							>
								<div className="flex items-center gap-3">
									<div
										className={cn(
											"size-2 rounded-full",
											item.hasUnlimitedStock
												? "bg-blue-500"
												: item.currentStock > 10
													? "bg-green-500"
													: item.currentStock > 0
														? "bg-yellow-500"
														: "bg-red-500",
										)}
									/>
									<span className="font-medium text-sm">{item.name}</span>
								</div>
								<div className="flex items-center gap-2">
									{item.hasUnlimitedStock ? (
										<Badge variant="secondary" className="text-xs">
											Unlimited
										</Badge>
									) : (
										<Badge
											variant={
												item.currentStock > 10
													? "default"
													: item.currentStock > 0
														? "secondary"
														: "destructive"
											}
											className="text-xs tabular-nums min-w-12 justify-center"
										>
											{item.currentStock}
										</Badge>
									)}
									{!item.enabled && (
										<Badge variant="outline" className="text-xs">
											Disabled
										</Badge>
									)}
								</div>
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

function AuditLogList({ logs }: { logs: AuditLogEntry[] }) {
	const getActionBadge = (action: AuditLogEntry["action"]) => {
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
		}
	};

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Clock className="size-5" />
					Audit Log
				</CardTitle>
				<CardDescription>Today's inventory changes</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-75 px-6">
					{logs.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
							<Clock className="size-10 mb-2 opacity-50" />
							<p className="text-sm">No audit logs today</p>
						</div>
					) : (
						<div className="space-y-3 pb-4">
							{logs.map((log) => (
								<div
									key={log.id}
									className="flex items-start justify-between p-3 rounded-lg border"
								>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-sm">
												{log.dessertName}
											</span>
											{getActionBadge(log.action)}
										</div>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<span className="tabular-nums">
												{log.previousQuantity} → {log.newQuantity}
											</span>
											{log.orderId && (
												<span className="text-muted-foreground">
													Order #{log.orderId}
												</span>
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

export function DashboardContent({
	stats,
	stock,
	auditLogs,
	dailyRevenue,
}: DashboardContentProps) {
	const [todayLabel, setTodayLabel] = useState("");

	useEffect(() => {
		setTodayLabel(
			new Date().toLocaleDateString("en-IN", {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
				timeZone: "Asia/Kolkata",
			}),
		);
	}, []);

	const avgOrderValue =
		stats.todayOrdersCount > 0
			? stats.todayRevenue / stats.todayOrdersCount
			: 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold">Dashboard</h1>
				<p className="text-sm text-muted-foreground">{todayLabel}</p>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					title="Today's Orders"
					value={stats.todayOrdersCount}
					subtitle={`${stats.weekOrdersCount} this week`}
					icon={ShoppingCart}
				/>
				<StatCard
					title="Today's Revenue"
					value={formatCurrency(stats.todayRevenue)}
					subtitle={`${formatCurrency(stats.weekRevenue)} this week`}
					icon={IndianRupee}
					trend={stats.todayRevenue > 0 ? "up" : "neutral"}
				/>
				<StatCard
					title="Items Sold"
					value={stats.todayItemsSold}
					subtitle="Today"
					icon={Package}
				/>
				<StatCard
					title="Avg Order Value"
					value={formatCurrency(avgOrderValue)}
					subtitle="Today"
					icon={TrendingUp}
				/>
			</div>

			{/* Revenue Chart */}
			<RevenueChart data={dailyRevenue} />

			{/* Stock and Audit Log */}
			<div className="grid md:grid-cols-2 gap-6">
				<StockList stock={stock} />
				<AuditLogList logs={auditLogs} />
			</div>
		</div>
	);
}
