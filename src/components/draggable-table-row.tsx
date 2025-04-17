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
						className="cursor-grab touch-none"
						{...attributes}
						{...listeners}
					>
						<GripVertical className="h-4 w-4" />
					</Button>
					<span className="font-medium max-w-28 truncate">{dessert.name}</span>
				</div>
			</TableCell>
			<TableCell>{dessert.price.toFixed(2)}</TableCell>
			<TableCell className="flex gap-2">
				<Button variant="outline" onClick={() => onEdit(dessert)}>
					Edit
				</Button>
				<Button variant="outline" onClick={() => onToggle(dessert)}>
					{dessert.enabled ? "Disable" : "Enable"}
				</Button>
			</TableCell>
		</TableRow>
	);
}
