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
	onEdit?: (dessert: Dessert) => void;
	onToggle?: (dessert: Dessert) => void;
	onMoveUp: (dessert: Dessert) => void;
	onMoveDown: (dessert: Dessert) => void;
	onMoveToTop: (dessert: Dessert) => void;
	onMoveToBottom: (dessert: Dessert) => void;
	isToggleLoading?: boolean;
	isMoving?: boolean;
	showEditControls?: boolean;
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
	showEditControls = true,
}: DessertCardProps) {
	return (
		<div className="@container/card">
			<div
				className={cn(
					"bg-card border rounded-lg p-3 @sm/card:p-4 shadow-sm hover:shadow-md transition-all duration-200 group",
					"hover:scale-[1.02] hover:border-primary/20",
					!dessert.enabled && "opacity-60 bg-muted",
					isMoving && "scale-95 shadow-lg ring-2 ring-primary/20",
				)}
			>
				{/* Header with name */}
				<div className="mb-2">
					<h3
						className={cn(
							"font-semibold text-base @sm/card:text-lg leading-tight break-words",
							!dessert.enabled && "line-through text-muted-foreground",
						)}
						title={dessert.name}
					>
						{dessert.name}
					</h3>
				</div>

				{/* Price - now on its own line */}
				<div className="mb-2 flex items-center gap-2">
					<div
						className={cn(
							"text-xl @sm/card:text-2xl font-bold",
							!dessert.enabled && "text-muted-foreground",
						)}
					>
						₹{dessert.price.toFixed(2)}
					</div>

					<div
						className={cn(
							"px-2 py-1 rounded-full text-xs font-medium w-fit",
							dessert.enabled
								? "bg-green-100 text-green-700"
								: "bg-red-100 text-red-700",
						)}
					>
						{dessert.enabled ? "Available" : "Disabled"}
					</div>
				</div>

				{/* Description */}
				{dessert.description && (
					<p className="text-xs @sm/card:text-sm text-muted-foreground mb-3 line-clamp-2">
						{dessert.description}
					</p>
				)}

				{/* Status and position - now stacked on small screens */}
				<div className="flex flex-col @sm/card:flex-row @sm/card:items-center gap-2 @sm/card:gap-3 mb-3 text-xs text-muted">
					#{index + 1} in order
				</div>

				{/* Actions - now wrapped and responsive */}
				<div className="flex flex-col gap-2 @sm/card:flex-row @sm/card:items-center @sm/card:justify-between">
					{/* Reorder buttons */}
					<div className="flex items-center gap-0.5 @sm/card:gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onMoveToTop(dessert)}
							disabled={index === 0 || isMoving || totalCount <= 1}
							className="h-7 w-7 @sm/card:h-8 @sm/card:w-8 p-0"
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
							disabled={index === 0 || isMoving}
							className="h-7 w-7 @sm/card:h-8 @sm/card:w-8 p-0"
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
							disabled={index === totalCount - 1 || isMoving}
							className="h-7 w-7 @sm/card:h-8 @sm/card:w-8 p-0"
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
							disabled={index === totalCount - 1 || isMoving || totalCount <= 1}
							className="h-7 w-7 @sm/card:h-8 @sm/card:w-8 p-0"
							title="Move to bottom"
						>
							{isMoving ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<ChevronsDown className="h-3 w-3" />
							)}
						</Button>
					</div>

					{/* Edit and toggle buttons */}
					{showEditControls && onEdit && onToggle && (
						<div className="flex items-center gap-1.5 @sm/card:gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => onEdit(dessert)}
								className="text-xs flex-1 @sm/card:flex-none"
							>
								Edit
							</Button>
							<Button
								variant={dessert.enabled ? "outline" : "secondary"}
								size="sm"
								onClick={() => onToggle(dessert)}
								disabled={isToggleLoading}
								className={cn(
									"text-xs min-w-[4rem] @sm/card:min-w-16 flex-1 @sm/card:flex-none",
									dessert.enabled
										? "border-green-200 text-green-700 hover:bg-green-50"
										: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
								)}
							>
								{isToggleLoading ? (
									<>
										<Loader2 className="h-3 w-3 animate-spin mr-1" />
										<span className="hidden @sm/card:inline">
											{dessert.enabled ? "Disabling" : "Enabling"}
										</span>
									</>
								) : dessert.enabled ? (
									"Enabled"
								) : (
									"Disabled"
								)}
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
