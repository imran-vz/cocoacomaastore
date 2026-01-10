"use client";

import { Package } from "lucide-react";
import type { ComboWithDetails } from "@/lib/types";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

interface ComboGridProps {
	combos: ComboWithDetails[];
	onAddComboToCart: (combo: ComboWithDetails) => void;
}

export function ComboGrid({ combos, onAddComboToCart }: ComboGridProps) {
	return (
		<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
			{combos.map((combo) => {
				// Compute display price
				const modifierTotal = combo.items.reduce(
					(sum, item) => sum + item.dessert.price * item.quantity,
					0,
				);
				const displayPrice =
					combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

				return (
					<Card
						key={combo.id}
						className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] transition-transform"
						onClick={() => onAddComboToCart(combo)}
					>
						<CardContent className="p-3 flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Package className="size-4 text-primary shrink-0" />
								<h3 className="font-medium text-sm truncate">{combo.name}</h3>
							</div>

							<p className="text-xs text-muted-foreground line-clamp-2">
								{combo.baseDessert.name}
								{combo.items.length > 0 && (
									<>
										{" "}
										+{" "}
										{combo.items
											.map((item) =>
												item.quantity > 1
													? `${item.quantity}× ${item.dessert.name}`
													: item.dessert.name,
											)
											.join(", ")}
									</>
								)}
							</p>

							<div className="flex items-center justify-between mt-auto pt-1">
								<span className="font-semibold text-sm">₹{displayPrice}</span>
								<Button size="sm" variant="secondary" className="h-7 text-xs">
									Add
								</Button>
							</div>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
