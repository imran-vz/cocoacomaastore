"use client";

import { createOrder } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/types";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "./ui/input";
import { toast } from "sonner";

interface CartProps {
	cart: CartItem[];
	updateQuantity: (dessertId: number, quantity: number) => void;
	removeFromCart: (dessertId: number) => void;
	total: number;
	clearCart: () => void;
}

export function Cart({
	cart,
	updateQuantity,
	removeFromCart,
	total,
	clearCart,
}: CartProps) {
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleCheckout = async () => {
		if (!name) {
			toast.error("Please enter a name");
			return;
		}

		setIsLoading(true);
		try {
			await createOrder({
				customerName: name,
				items: cart,
			});
			clearCart();
			setName("");
			toast.success("Order created successfully");
		} catch (error) {
			console.error(error);
			toast.error("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};
	if (cart.length === 0) {
		return (
			<div className="text-center py-6 text-muted-foreground">
				<p>Your cart is empty</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="mb-4">
				<Input
					placeholder="Customer Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>

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
				<div className="flex justify-between mt-4">
					<p className="text-sm">Total:</p>
					<p className="text-sm font-medium">₹{total.toFixed(2)}</p>
				</div>
				<div className="flex justify-end mt-4">
					<Button variant="outline" onClick={handleCheckout}>
						{isLoading ? "Processing..." : "Checkout"}
					</Button>
				</div>
			</div>
		</div>
	);
}
