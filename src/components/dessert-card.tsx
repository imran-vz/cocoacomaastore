"use client";

import {
	ChevronDown,
	ChevronsDown,
	ChevronsUp,
	ChevronUp,
	Loader2,
} from "lucide-react";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface DessertCardProps {
	dessert: Dessert;
	index: number;
	totalCount: number;
	onEdit: (dessert: Dessert) => void;
	onToggle: (dessert: Dessert) => void;
	onMoveUp: (dessert: Dessert) => void;
	onMoveDown: (dessert: Dessert) => void;
	onMoveToTop: (dessert: Dessert) => void;
	onMoveToBottom: (dessert: Dessert) => void;
	isToggleLoading?: boolean;
	isMoving?: boolean;
	enabledDessertIndex?: number;
	enabledDessertCount?: number;
}

export function DessertCard({
	dessert,
	index,
	totalCount,
	onEdit,
	onToggle,
	onMoveUp,
	onMoveDown,
	onMoveToTop,
	onMoveToBottom,
	isToggleLoading = false,
	isMoving = false,
	enabledDessertIndex,
	enabledDessertCount,
}: DessertCardProps) {
	return (
		<div
			className={cn(
				"bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 group",
				"hover:scale-[1.02] hover:border-primary/20",
				!dessert.enabled && "opacity-60 bg-muted",
				isMoving && "scale-95 shadow-lg ring-2 ring-primary/20",
			)}
		>
			{/* Header with name and price */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0 mr-2">
					<h3
						className={cn(
							"font-semibold text-lg leading-tight",
							!dessert.enabled && "line-through text-muted-foreground",
						)}
						title={dessert.name}
					>
						{dessert.name}
					</h3>
					{dessert.description && (
						<p className="text-sm text-muted-foreground mt-1 line-clamp-2">
							{dessert.description}
						</p>
					)}
				</div>
				<div className="text-right flex-shrink-0">
					<div
						className={cn(
							"text-xl font-bold",
							!dessert.enabled && "text-muted-foreground",
						)}
					>
						₹{dessert.price.toFixed(2)}
					</div>
				</div>
			</div>

			{/* Status and position */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"px-2 py-1 rounded-full text-xs font-medium",
							dessert.enabled
								? "bg-green-100 text-green-700"
								: "bg-red-100 text-red-700",
						)}
					>
						{dessert.enabled ? "Available" : "Disabled"}
					</div>
					<span className="text-xs text-muted-foreground">
						#{index + 1} in order
					</span>
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center justify-between">
				{/* Reorder buttons - only show for enabled desserts */}
				{dessert.enabled && (
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onMoveToTop(dessert)}
							disabled={
								(enabledDessertIndex ?? index) === 0 ||
								isMoving ||
								(enabledDessertCount ?? totalCount) <= 1
							}
							className="h-8 w-8 p-0"
							title="Move to top"
						>
							{isMoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<ChevronsUp className="h-3 w-3" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onMoveUp(dessert)}
							disabled={(enabledDessertIndex ?? index) === 0 || isMoving}
							className="h-8 w-8 p-0"
							title="Move up"
						>
							{isMoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<ChevronUp className="h-3 w-3" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onMoveDown(dessert)}
							disabled={
								(enabledDessertIndex ?? index) ===
									(enabledDessertCount ?? totalCount) - 1 || isMoving
							}
							className="h-8 w-8 p-0"
							title="Move down"
						>
							{isMoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<ChevronDown className="h-3 w-3" />
							)}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onMoveToBottom(dessert)}
							disabled={
								(enabledDessertIndex ?? index) ===
									(enabledDessertCount ?? totalCount) - 1 ||
								isMoving ||
								(enabledDessertCount ?? totalCount) <= 1
							}
							className="h-8 w-8 p-0"
							title="Move to bottom"
						>
							{isMoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<ChevronsDown className="h-3 w-3" />
							)}
						</Button>
					</div>
				)}
				{/* Spacer for disabled desserts */}
				{!dessert.enabled && <div />}

				{/* Edit and toggle buttons */}
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onEdit(dessert)}
						className="text-xs"
					>
						Edit
					</Button>
					<Button
						variant={dessert.enabled ? "outline" : "secondary"}
						size="sm"
						onClick={() => onToggle(dessert)}
						disabled={isToggleLoading}
						className={cn(
							"text-xs min-w-16",
							dessert.enabled
								? "border-green-200 text-green-700 hover:bg-green-50"
								: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
						)}
					>
						{isToggleLoading ? (
							<>
								<Loader2 className="h-3 w-3 animate-spin mr-1" />
								<span className="hidden sm:inline">
									{dessert.enabled ? "Disabling" : "Enabling"}
								</span>
							</>
						) : (
							<>{dessert.enabled ? "Enabled" : "Disabled"}</>
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
