"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { createOrder } from "@/app/manager/orders/actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { UpiAccount } from "@/db/schema";
import type { CartItem } from "@/lib/types";
import { useUpiStore } from "@/store/upi-store";

interface ReceiptProps {
	cart: CartItem[];
	total: number;
	clearCart: () => void;
	deliveryCost: number;
	upiAccounts: UpiAccount[];
	customerName: string;
	onOrderSaved?: () => void | Promise<void>;
}

export function Receipt({
	cart,
	total,
	clearCart,
	deliveryCost,
	upiAccounts,
	customerName,
	onOrderSaved,
}: ReceiptProps) {
	const { selectedUpiId, setSelectedUpiId } = useUpiStore();
	const [isSavingOrder, setIsSavingOrder] = useState(false);

	// Initialize with first available account if selectedUpiId is invalid
	useEffect(() => {
		const isValid = upiAccounts.some(
			(account) => account.id.toString() === selectedUpiId,
		);
		if (!isValid && upiAccounts.length > 0) {
			setSelectedUpiId(upiAccounts[0].id.toString());
		}
	}, [upiAccounts, selectedUpiId, setSelectedUpiId]);

	const handleSaveOrder = async () => {
		if (cart.length === 0) return;
		if (isSavingOrder) return;
		try {
			setIsSavingOrder(true);
			await createOrder({
				customerName: customerName.trim(),
				items: cart,
				deliveryCost: deliveryCost.toFixed(2),
			});
			toast.success("Order saved");
			await onOrderSaved?.();
			clearCart();
		} catch (err) {
			console.error("Failed to create order:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save order");
		} finally {
			setIsSavingOrder(false);
		}
	};

	return (
		<div>
			<div className="bg-white p-3 font-mono text-xs border border-dashed border-gray-300 rounded-md">
				<div className="text-center mb-3">
					<h3 className="font-bold text-base">COCOA COMAA</h3>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				<div className="mb-4">
					<p>Date: {new Date().toLocaleDateString()}</p>
					<p>Time: {new Date().toLocaleTimeString()}</p>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				<div className="space-y-1 mb-3">
					<table className="w-full">
						<thead>
							<tr className="font-bold">
								<th className="text-left">Item</th>
								<th className="text-center w-8">Qty</th>
								<th className="text-right w-16">Price</th>
							</tr>
						</thead>
						<tbody>
							{cart.map((item) => (
								<tr key={item.id}>
									<td className="truncate max-w-37.5">{item.name}</td>
									<td className="text-center">{item.quantity}</td>
									<td className="text-right">
										{(item.price * item.quantity).toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				{deliveryCost > 0 && (
					<>
						<div className="flex justify-between font-bold text-sm">
							<span>Delivery Cost:</span>
							<span>₹{deliveryCost.toFixed(2)}</span>
						</div>

						<Separator className="my-4 h-px border-t border-gray-300" />
					</>
				)}

				<div className="flex justify-between font-bold text-sm">
					<span>Total:</span>
					<span>₹{total.toFixed(2)}</span>
				</div>
			</div>

			<div className="flex gap-2 mt-4">
				<Button onClick={clearCart} variant="outline">
					<X className="mr-2 h-4 w-4" />
					Cancel
				</Button>
				<Button
					onClick={handleSaveOrder}
					className="flex-1"
					disabled={isSavingOrder}
				>
					{isSavingOrder ? <Spinner /> : "Save Order"}
				</Button>
			</div>
		</div>
	);
}
