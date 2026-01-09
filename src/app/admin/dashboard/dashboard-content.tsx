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
import { useCallback, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { DateSwitcher } from "@/components/date-switcher";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
	type AuditLogEntry,
	type DailyRevenue,
	type DashboardStats,
	type DessertStock,
	getCachedAuditLogs,
	getCachedDailyRevenue,
	getCachedDashboardStats,
	getCachedStockPerDessert,
} from "./actions";

type DashboardContentProps = {
	stats: DashboardStats;
	stock: DessertStock[];
	auditLogs: AuditLogEntry[];
	dailyRevenue: DailyRevenue[];
};

function formatDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

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
	isLoading,
}: {
	title: string;
	value: string | number;
	subtitle?: string;
	icon: React.ElementType;
	trend?: "up" | "down" | "neutral";
	className?: string;
	isLoading?: boolean;
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
				{isLoading ? (
					<Skeleton className="h-8 w-20" />
				) : (
					<div className="text-2xl font-bold">{value}</div>
				)}
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

const chartConfig = {
	revenue: {
		label: "Revenue",
		color: "var(--chart-1)",
	},
	orders: {
		label: "Orders",
		color: "var(--chart-2)",
	},
} satisfies ChartConfig;

function RevenueChart({
	data,
	isLoading,
}: {
	data: DailyRevenue[];
	isLoading?: boolean;
}) {
	if (isLoading) {
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
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
	const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
					<div>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="size-5" />
							Revenue Trend
						</CardTitle>
						<CardDescription>Last 7 days revenue</CardDescription>
					</div>
					<div className="flex gap-4 text-sm">
						<div>
							<p className="text-muted-foreground">Total Revenue</p>
							<p className="font-semibold">{formatCurrency(totalRevenue)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">Total Orders</p>
							<p className="font-semibold">{totalOrders}</p>
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="h-64 w-full">
					<AreaChart
						accessibilityLayer
						data={data}
						margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
					>
						<defs>
							<linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-revenue)"
									stopOpacity={0.3}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-revenue)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" vertical={false} />
						<XAxis
							dataKey="date"
							axisLine={false}
							tickLine={false}
							tickMargin={10}
						/>
						<YAxis
							axisLine={false}
							tickLine={false}
							tickMargin={10}
							tickFormatter={(value) =>
								value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`
							}
							width={50}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									formatter={(value, name) => (
										<div className="flex items-center justify-between gap-8">
											<span className="text-muted-foreground">
												{name === "revenue" ? "Revenue" : name}
											</span>
											<span className="font-mono font-medium">
												{name === "revenue"
													? formatCurrency(value as number)
													: value}
											</span>
										</div>
									)}
								/>
							}
						/>
						<Area
							type="monotone"
							dataKey="revenue"
							stroke="var(--color-revenue)"
							strokeWidth={2}
							fill="url(#revenueGradient)"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function StockList({
	stock,
	isLoading,
}: {
	stock: DessertStock[];
	isLoading?: boolean;
}) {
	const filteredStock = stock.filter((item) => item.enabled);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Box className="size-5" />
					Stock Levels
				</CardTitle>
				<CardDescription>Inventory for selected date</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-75 px-6">
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
					)}
				</ScrollArea>
			</CardContent>
		</Card>
	);
}

function AuditLogList({
	logs,
	isLoading,
}: {
	logs: AuditLogEntry[];
	isLoading?: boolean;
}) {
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
				<CardDescription>Inventory changes for selected date</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 p-0">
				<ScrollArea className="h-75 px-6">
					{isLoading ? (
						<div className="space-y-3 pb-4">
							{[1, 2, 3, 4, 5].map((i) => (
								<Skeleton key={i} className="h-16 w-full rounded-lg" />
							))}
						</div>
					) : logs.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
							<Clock className="size-10 mb-2 opacity-50" />
							<p className="text-sm">No audit logs for this date</p>
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
	stats: initialStats,
	stock: initialStock,
	auditLogs: initialAuditLogs,
	dailyRevenue: initialDailyRevenue,
}: DashboardContentProps) {
	const [selectedDate, setSelectedDate] = useState<Date>(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	});
	const [isLoading, setIsLoading] = useState(false);

	const [stats, setStats] = useState(initialStats);
	const [stock, setStock] = useState(initialStock);
	const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
	const [dailyRevenue, setDailyRevenue] = useState(initialDailyRevenue);

	const handleDateChange = useCallback(async (date: Date) => {
		setSelectedDate(date);
		setIsLoading(true);

		try {
			const dateString = formatDateString(date);
			const [newStats, newStock, newAuditLogs, newDailyRevenue] =
				await Promise.all([
					getCachedDashboardStats(dateString),
					getCachedStockPerDessert(dateString),
					getCachedAuditLogs(dateString),
					getCachedDailyRevenue(dateString),
				]);

			setStats(newStats);
			setStock(newStock);
			setAuditLogs(newAuditLogs);
			setDailyRevenue(newDailyRevenue);
		} catch (error) {
			console.error("Failed to fetch dashboard data:", error);
		} finally {
			setIsLoading(false);
		}
	}, []);

	const avgOrderValue =
		stats.dayOrdersCount > 0 ? stats.dayRevenue / stats.dayOrdersCount : 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Dashboard</h1>
					<p className="text-sm text-muted-foreground">
						View stats and activity
					</p>
				</div>
				<DateSwitcher
					selectedDate={selectedDate}
					onDateChange={handleDateChange}
				/>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					title="Orders"
					value={stats.dayOrdersCount}
					subtitle={`${stats.weekOrdersCount} in last 7 days`}
					icon={ShoppingCart}
					isLoading={isLoading}
				/>
				<StatCard
					title="Revenue"
					value={formatCurrency(stats.dayRevenue)}
					subtitle={`${formatCurrency(stats.weekRevenue)} in last 7 days`}
					icon={IndianRupee}
					trend={stats.dayRevenue > 0 ? "up" : "neutral"}
					isLoading={isLoading}
				/>
				<StatCard
					title="Items Sold"
					value={stats.dayItemsSold}
					subtitle="For selected date"
					icon={Package}
					isLoading={isLoading}
				/>
				<StatCard
					title="Avg Order Value"
					value={formatCurrency(avgOrderValue)}
					subtitle="For selected date"
					icon={TrendingUp}
					isLoading={isLoading}
				/>
			</div>

			{/* Revenue Chart */}
			<RevenueChart data={dailyRevenue} isLoading={isLoading} />

			{/* Stock and Audit Log */}
			<div className="grid md:grid-cols-2 gap-6">
				<StockList stock={stock} isLoading={isLoading} />
				<AuditLogList logs={auditLogs} isLoading={isLoading} />
			</div>
		</div>
	);
}
