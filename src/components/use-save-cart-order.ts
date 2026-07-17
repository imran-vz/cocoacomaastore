"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { OrderSubmissionIdentity } from "@/lib/pos-cart-behaviour";
import { completeAcknowledgedOrder, resolveOrderSubmissionIdentity, saveCartOrder } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";

export type SaveCartOrderOptions = {
	customerName: string;
	deliveryCost: string | number;
	closeCart?: () => void;
};

export type SaveCartOrder = (options: SaveCartOrderOptions) => Promise<void>;

export function useSaveCartOrder({
	cart,
	clearCart,
	refreshInventory,
}: {
	cart: CartLine[];
	clearCart: () => void;
	refreshInventory: () => void | Promise<void>;
}) {
	const submissionIdentityRef = useRef<OrderSubmissionIdentity | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	const saveOrder = useCallback<SaveCartOrder>(
		async ({ customerName, deliveryCost, closeCart }) => {
			if (cart.length === 0 || isSaving) return;

			setIsSaving(true);
			try {
				const submissionIdentity = resolveOrderSubmissionIdentity(
					submissionIdentityRef.current,
					{ cart, customerName, deliveryCost },
					globalThis.crypto.randomUUID(),
				);
				submissionIdentityRef.current = submissionIdentity;

				const result = await saveCartOrder(createOrderWithLines, {
					cart,
					customerName,
					deliveryCost,
					submissionId: submissionIdentity.submissionId,
				});
				if (!result.ok) {
					toast.error(result.error);
					return;
				}

				toast.success(result.replayed ? "Order already saved" : "Order saved!");
				const acknowledgement = await completeAcknowledgedOrder({
					acknowledgement: result,
					clearCart: () => {
						submissionIdentityRef.current = null;
						clearCart();
					},
					closeCart,
					refreshInventory,
				});
				if (result.refreshWarning) {
					toast.warning("Order saved, but reporting refresh failed");
				} else if (acknowledgement.refreshWarning) {
					toast.warning("Order saved, but inventory refresh failed");
				}
			} catch (error) {
				console.error("Failed to save order:", error);
				toast.error(error instanceof Error ? error.message : "Failed to save order");
			} finally {
				setIsSaving(false);
			}
		},
		[cart, clearCart, isSaving, refreshInventory],
	);

	return { isSaving, saveOrder };
}
