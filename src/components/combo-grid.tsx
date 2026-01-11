"use client";

import type { ComboWithDetails } from "@/lib/types";
import { ComboGridItem } from "./combo-grid-item";

interface ComboGridProps {
	combos: ComboWithDetails[];
	onAddComboToCart: (combo: ComboWithDetails) => void;
}

export function ComboGrid({ combos, onAddComboToCart }: ComboGridProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			{combos.map((combo) => (
				<ComboGridItem
					key={combo.id}
					combo={combo}
					onAddComboToCart={onAddComboToCart}
				/>
			))}
		</div>
	);
}
