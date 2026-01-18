import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function StatCard({
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
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<Icon className="h-4 w-4 text-muted-foreground" />
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
