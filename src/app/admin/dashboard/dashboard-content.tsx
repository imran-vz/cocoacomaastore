"use client";

import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { use, useCallback, useMemo, useState } from "react";
import AuditLogList from "@/components/admin/dashboard/audit-log-list";
import RevenueChart from "@/components/admin/dashboard/revenue-chart";
import StatCard from "@/components/admin/dashboard/stats-card";
import StockList from "@/components/admin/dashboard/stock-list";
import { DateSwitcher } from "@/components/date-switcher";
import { formatCurrency } from "@/lib/utils";
import type { AuditLogEntry, DailyRevenue, DashboardStats, DessertStock } from "./actions";

type DashboardContentProps = {
	stats: Promise<DashboardStats>;
	stock: Promise<DessertStock[]>;
	auditLogs: Promise<AuditLogEntry[]>;
	dailyRevenue: Promise<DailyRevenue[]>;
};

function formatDateString(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

type DashboardData = {
	stats: DashboardStats;
	stock: DessertStock[];
	auditLogs: AuditLogEntry[];
	dailyRevenue: DailyRevenue[];
};

async function fetchDashboardData(dateString: string, signal?: AbortSignal): Promise<DashboardData> {
	const response = await fetch(`/api/admin/dashboard?date=${encodeURIComponent(dateString)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch dashboard data (${response.status})`);
	}

	return response.json();
}

export function DashboardContent({
	stats: statsPromise,
	stock: stockPromise,
	auditLogs: auditLogsPromise,
	dailyRevenue: dailyRevenuePromise,
}: DashboardContentProps) {
	const initialStats = use(statsPromise);
	const initialStock = use(stockPromise);
	const initialAuditLogs = use(auditLogsPromise);
	const initialDailyRevenue = use(dailyRevenuePromise);
	const [initialDateString] = useState(() => formatDateString(new Date()));
	const [selectedDate, setSelectedDate] = useState<Date>(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	});
	const selectedDateString = useMemo(() => formatDateString(selectedDate), [selectedDate]);
	const initialDashboardData = useMemo(
		() => ({
			stats: initialStats,
			stock: initialStock,
			auditLogs: initialAuditLogs,
			dailyRevenue: initialDailyRevenue,
		}),
		[initialStats, initialStock, initialAuditLogs, initialDailyRevenue],
	);
	const {
		data: queriedDashboardData,
		error,
		isFetching,
	} = useQuery({
		queryKey: ["admin-dashboard", selectedDateString],
		queryFn: ({ signal }) => fetchDashboardData(selectedDateString, signal),
		initialData: selectedDateString === initialDateString ? initialDashboardData : undefined,
		placeholderData: (previousData) => previousData,
	});

	const handleDateChange = useCallback((date: Date) => {
		setSelectedDate(date);
	}, []);

	if (error) {
		console.error("Failed to fetch dashboard data:", error);
	}

	const dashboardData = queriedDashboardData ?? initialDashboardData;
	const stats = dashboardData.stats;
	const stock = dashboardData.stock;
	const auditLogs = dashboardData.auditLogs;
	const dailyRevenue = dashboardData.dailyRevenue;
	const isLoading = isFetching;
	const avgOrderValue = stats.dayOrdersCount > 0 ? stats.dayRevenue / stats.dayOrdersCount : 0;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
					<p className="text-muted-foreground">Overview of your store's performance</p>
				</div>
				<DateSwitcher selectedDate={selectedDate} onDateChange={handleDateChange} />
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
