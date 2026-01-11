"use client";

import { motion, useAnimation } from "framer-motion";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ComboWithDetails } from "@/lib/types";

interface ComboGridItemProps {
	combo: ComboWithDetails;
	onAddComboToCart: (combo: ComboWithDetails) => void;
}

export function ComboGridItem({ combo, onAddComboToCart }: ComboGridItemProps) {
	const overlayControls = useAnimation();

	const handleClick = async () => {
		// Add to cart immediately
		onAddComboToCart(combo);

		// Cancel any ongoing animation and start fresh
		overlayControls.stop();
		overlayControls.set({ x: "100%" });

		// Run animation independently (fire and forget)
		overlayControls
			.start({
				x: ["100%", "0%"],
				transition: { duration: 0.3, ease: "easeInOut" },
			})
			.then(() =>
				overlayControls.start({
					x: "-100%",
					transition: { duration: 0.3, ease: "easeInOut" },
				}),
			)
			.then(() => overlayControls.set({ x: "100%" }));
	};

	// Compute display price
	const modifierTotal = combo.items.reduce(
		(sum, item) => sum + item.dessert.price * item.quantity,
		0,
	);
	const displayPrice =
		combo.overridePrice ?? combo.baseDessert.price + modifierTotal;

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.2 }}
		>
			<Card
				className="cursor-pointer hover:shadow-md p-0 transition-all active:scale-[0.98] h-full overflow-hidden relative"
				onClick={handleClick}
			>
				{/* Green slide overlay */}
				<motion.div
					className="absolute inset-0 bg-green-500/20 pointer-events-none z-0"
					initial={{ x: "100%" }}
					animate={overlayControls}
				/>

				<CardContent className="p-3 flex flex-col gap-2 h-full relative z-10">
					<div className="flex flex-col flex-1">
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
					</div>

					<div className="flex items-center justify-between mt-auto pt-1">
						<span className="font-semibold text-sm">₹{displayPrice}</span>
						<Button size="sm" variant="secondary" className="h-7 text-xs">
							Add
						</Button>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
