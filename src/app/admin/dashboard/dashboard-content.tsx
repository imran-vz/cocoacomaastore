"use client";

import { IndianRupee, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";
import AuditLogList from "@/components/admin/dashboard/audit-log-list";
import RevenueChart from "@/components/admin/dashboard/revenue-chart";
import StatCard from "@/components/admin/dashboard/stats-card";
import StockList from "@/components/admin/dashboard/stock-list";
import { DateSwitcher } from "@/components/date-switcher";
import { formatCurrency } from "@/lib/utils";
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
		<div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">
						Overview of your store's performance
					</p>
				</div>
				<DateSwitcher
					selectedDate={selectedDate}
					onDateChange={handleDateChange}
				/>
			</div>

			{/* Stats Grid */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StockList stock={stock} isLoading={isLoading} />
				<AuditLogList logs={auditLogs} isLoading={isLoading} />
			</div>
		</div>
	);
}
