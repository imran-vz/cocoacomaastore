"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import type { DailyRevenue } from "@/app/admin/dashboard/actions";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

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

export default function DesktopRevenueChart({ data }: { data: DailyRevenue[] }) {
	const formatChartMetric = (value: string | number | Array<string | number>, name: string | number) =>
		name === "revenue" ? formatCurrency(value as number) : value;
	return (
		<ChartContainer config={chartConfig} className="h-75 w-full">
			<ComposedChart accessibilityLayer data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
				<CartesianGrid strokeDasharray="3 8" vertical={false} />
				<XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
				<YAxis
					yAxisId="revenue"
					axisLine={false}
					tickLine={false}
					tickMargin={10}
					tickFormatter={(value) => (value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`)}
					width={50}
				/>
				<YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} tickMargin={10} width={34} />
				<ChartTooltip
					content={
						<ChartTooltipContent
							formatter={(value, name) => (
								<div className="flex w-full items-center justify-between gap-8">
									<span className="text-muted-foreground">{name === "revenue" ? "Revenue" : "Orders"}</span>
									<span className="font-mono font-medium tabular-nums">{formatChartMetric(value, name)}</span>
								</div>
							)}
						/>
					}
				/>
				<Bar yAxisId="revenue" dataKey="revenue" fill="#f2b38d" radius={[4, 4, 0, 0]} barSize={28} activeBar={false} />
				<Line
					yAxisId="orders"
					type="monotone"
					dataKey="orders"
					stroke="#12877f"
					strokeWidth={3}
					dot={false}
					activeDot={{
						r: 4,
						strokeWidth: 2,
						stroke: "var(--background)",
						fill: "#12877f",
					}}
				/>
			</ComposedChart>
		</ChartContainer>
	);
}
