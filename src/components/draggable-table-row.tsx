"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableRow, TableCell } from "./ui/table";
import { Button } from "./ui/button";
import type { Dessert } from "@/lib/types";
import { GripVertical } from "lucide-react";

interface Props {
	dessert: Dessert;
	onEdit: (dessert: Dessert) => void;
	onToggle: (dessert: Dessert) => void;
}

export function DraggableTableRow({ dessert, onEdit, onToggle }: Props) {
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
		<TableRow ref={setNodeRef} style={style}>
			<TableCell>
				<div className="flex items-center gap-2">
					<Button
						variant={"ghost"}
						className="cursor-grab touch-none p-1 md:p-2"
						{...attributes}
						{...listeners}
					>
						<GripVertical className="h-4 w-4" />
					</Button>
					<span className="font-medium max-w-20 md:max-w-28 truncate text-sm md:text-base">
						{dessert.name}
					</span>
				</div>
			</TableCell>
			<TableCell className="text-sm md:text-base">
				${dessert.price.toFixed(2)}
			</TableCell>
			<TableCell>
				<div className="flex flex-col gap-1 md:flex-row md:gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => onEdit(dessert)}
						className="text-xs md:text-sm min-w-16 md:min-w-0"
					>
						Edit
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onToggle(dessert)}
						className="text-xs md:text-sm min-w-16 md:min-w-0"
					>
						{dessert.enabled ? "Disable" : "Enable"}
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}
