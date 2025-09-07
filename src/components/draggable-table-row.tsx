"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import type { Dessert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { TableCell, TableRow } from "./ui/table";

interface Props {
	dessert: Dessert;
	onEdit: (dessert: Dessert) => void;
	onToggle: (dessert: Dessert) => void;
	isToggleLoading?: boolean;
}

export function DraggableTableRow({
	dessert,
	onEdit,
	onToggle,
	isToggleLoading = false,
}: Props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: dessert.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<TableRow
			ref={setNodeRef}
			style={style}
			className={cn(!dessert.enabled && "opacity-50 bg-muted/30")}
		>
			<TableCell>
				<div className="flex items-center gap-1 sm:gap-2">
					<div
						className="cursor-grab touch-none p-0.5 sm:p-1 md:p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
						{...attributes}
						{...listeners}
					>
						<GripVertical className="h-3 w-3 sm:h-4 sm:w-4" />
					</div>
					<span
						className={cn(
							"font-medium max-w-16 sm:max-w-20 md:max-w-28 truncate text-xs sm:text-sm md:text-base",
							!dessert.enabled && "line-through text-muted-foreground",
						)}
					>
						{dessert.name}
					</span>
				</div>
			</TableCell>
			<TableCell
				className={cn(
					"text-xs sm:text-sm md:text-base font-medium",
					!dessert.enabled && "text-muted-foreground",
				)}
			>
				₹{dessert.price.toFixed(2)}
			</TableCell>
			<TableCell>
				<div className="flex flex-col gap-1 sm:flex-row sm:gap-1 md:gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onEdit(dessert)}
						className="text-xs h-6 sm:h-8 min-w-12 sm:min-w-16 md:min-w-0 px-1 sm:px-2"
					>
						Edit
					</Button>
					<Button
						variant={dessert.enabled ? "outline" : "secondary"}
						size="sm"
						onClick={() => onToggle(dessert)}
						disabled={isToggleLoading}
						className={cn(
							"text-xs h-6 sm:h-8 min-w-12 sm:min-w-16 md:min-w-0 px-1 sm:px-2",
							dessert.enabled
								? "border-green-200 text-green-700 hover:bg-green-50"
								: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
						)}
					>
						{isToggleLoading ? (
							<>
								<Loader2 className="h-3 w-3 animate-spin mr-1" />
								{dessert.enabled ? "Disabling" : "Enabling"}
							</>
						) : (
							<>{dessert.enabled ? "Enabled" : "Disabled"}</>
						)}
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}
