"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { OrderSubmissionIdentity, SubmittedOrderSnapshot } from "@/lib/pos-cart-behaviour";
import { completeAcknowledgedOrder, resolveOrderSubmissionIdentity, saveCartOrder } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";

export type SaveCartOrderOptions = {
	customerName: string;
	deliveryCost: string;
	closeCart?: () => void;
};

export type SaveCartOrder = (options: SaveCartOrderOptions) => Promise<void>;

function snapshotCart(cart: readonly CartLine[]) {
	return cart.map((line) => ({
		...line,
		modifiers: line.modifiers.map((modifier) => ({ ...modifier })),
	}));
}

export function useSaveCartOrder({
	cart,
	intentVersion,
	acknowledgeSubmittedOrder,
	refreshInventory,
}: {
	cart: CartLine[];
	intentVersion: number;
	acknowledgeSubmittedOrder: (snapshot: SubmittedOrderSnapshot) => void;
	refreshInventory: () => void | Promise<void>;
}) {
	const submissionIdentityRef = useRef<OrderSubmissionIdentity | null>(null);
	const inFlightRef = useRef(false);
	const [isSaving, setIsSaving] = useState(false);

	const saveOrder = useCallback<SaveCartOrder>(
		async ({ customerName, deliveryCost, closeCart }) => {
			if (cart.length === 0 || inFlightRef.current) return;

			const snapshot: SubmittedOrderSnapshot = {
				cart: snapshotCart(cart),
				customerName,
				deliveryCost,
				intentVersion,
			};
			inFlightRef.current = true;
			setIsSaving(true);
			try {
				const submissionIdentity = resolveOrderSubmissionIdentity(
					submissionIdentityRef.current,
					snapshot,
					globalThis.crypto.randomUUID(),
				);
				submissionIdentityRef.current = submissionIdentity;

				const result = await saveCartOrder(createOrderWithLines, {
					cart: snapshot.cart,
					customerName: snapshot.customerName,
					deliveryCost: snapshot.deliveryCost,
					submissionId: submissionIdentity.submissionId,
				});
				if (!result.ok) {
					toast.error(result.error);
					return;
				}
				if (result.receipt.id !== result.orderId) {
					toast.error("The saved order receipt could not be verified. Please retry.");
					return;
				}

				const completion = completeAcknowledgedOrder({
					acknowledgement: result,
					acknowledgeSubmittedOrder: () => acknowledgeSubmittedOrder(snapshot),
					closeCart,
					refreshInventory,
				});
				submissionIdentityRef.current = null;
				// Free the button as soon as the server confirms; the inventory
				// refetch in `completion` only gates the warning toasts below.
				inFlightRef.current = false;
				setIsSaving(false);
				toast.success(result.replayed ? `Order #${result.orderId} already saved` : `Order #${result.orderId} saved!`);

				const acknowledgement = await completion;
				if (result.refreshWarning) {
					toast.warning("Order saved, but reporting refresh failed");
				} else if (acknowledgement.refreshWarning) {
					toast.warning("Order saved, but inventory refresh failed");
				}
			} catch (error) {
				console.error("Failed to save order:", error);
				toast.error(error instanceof Error ? error.message : "Failed to save order");
			} finally {
				inFlightRef.current = false;
				setIsSaving(false);
			}
		},
		[acknowledgeSubmittedOrder, cart, intentVersion, refreshInventory],
	);

	return { isSaving, saveOrder };
}
