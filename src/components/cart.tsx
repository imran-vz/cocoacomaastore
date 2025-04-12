"use client";

import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/types";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartProps {
	cart: CartItem[];
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
	total: number;
}

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	total,
}: CartProps) {
	if (cart.length === 0) {
		return (
			<div className="text-center py-6 text-muted-foreground">
				<p>Your cart is empty</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="overflow-auto max-h-[200px]">
				{cart.map((item) => (
					<div
						key={item.id}
						className="flex items-center py-2 border-b last:border-b-0"
					>
						<div className="flex-1">
							<h4 className="font-medium text-sm">{item.name}</h4>
							<p className="text-xs text-muted-foreground">
								{item.price.toFixed(2)}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7"
								onClick={() => updateQuantity(item.id, item.quantity - 1)}
							>
								<Minus className="h-3 w-3" />
							</Button>
							<span className="w-6 text-center text-sm">{item.quantity}</span>
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7"
								onClick={() => updateQuantity(item.id, item.quantity + 1)}
							>
								<Plus className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-destructive"
								onClick={() => removeFromCart(item.id)}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
