"use client";

import { useCallback, useRef } from "react";
import { createOrderWithLines } from "@/app/manager/orders/actions";
import { useReactiveButton } from "@/components/ui/reactive-button";
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
	total,
	intentVersion,
	acknowledgeSubmittedOrder,
	refreshInventory,
}: {
	cart: CartLine[];
	total: number;
	intentVersion: number;
	acknowledgeSubmittedOrder: (snapshot: SubmittedOrderSnapshot) => void;
	refreshInventory: () => void | Promise<void>;
}) {
	const submissionIdentityRef = useRef<OrderSubmissionIdentity | null>(null);
	const inFlightRef = useRef<number | null>(null);
	const cartInteractionVersionRef = useRef(0);

	const [saveControls, SaveButton] = useReactiveButton({
		label: cart.length === 0 ? "Add items to save" : `Save Order · ₹${total.toFixed(0)}`,
		loading: { label: "Saving order..." },
		success: { duration: 1200 },
		feedbackStyle: "brand",
	});
	const { setLoading, setSuccess, setError, reset } = saveControls;

	const registerCartInteraction = useCallback(() => {
		cartInteractionVersionRef.current += 1;
		reset({ ifStatus: "success" });
	}, [reset]);

	const saveOrder = useCallback<SaveCartOrder>(
		async ({ customerName, deliveryCost, closeCart }) => {
			if (cart.length === 0 || inFlightRef.current !== null) return;

			const snapshot: SubmittedOrderSnapshot = {
				cart: snapshotCart(cart),
				customerName,
				deliveryCost,
				intentVersion,
			};
			const cartInteractionVersion = cartInteractionVersionRef.current;
			const token = setLoading();
			inFlightRef.current = token;
			const releaseSave = () => {
				if (inFlightRef.current !== token) return false;
				inFlightRef.current = null;
				return true;
			};

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
					setError(result.error, { token });
					return;
				}
				if (result.receipt.id !== result.orderId) {
					setError("Receipt mismatch — retry", { token });
					return;
				}

				const completion = completeAcknowledgedOrder({
					acknowledgement: result,
					acknowledgeSubmittedOrder: () => acknowledgeSubmittedOrder(snapshot),
					refreshInventory,
				});
				submissionIdentityRef.current = null;
				releaseSave();
				const message = result.replayed ? `Order #${result.orderId} already saved` : `Order #${result.orderId} saved`;
				setSuccess(message, {
					token,
					onComplete: () => {
						if (cartInteractionVersionRef.current === cartInteractionVersion) closeCart?.();
					},
				});

				const acknowledgement = await completion;
				if (result.refreshWarning) {
					console.warn("Order saved, but reporting refresh failed");
				} else if (acknowledgement.refreshWarning) {
					console.warn("Order saved, but inventory refresh failed");
				}
			} catch (error) {
				console.error("Failed to save order:", error);
				setError(error instanceof Error ? error.message : "Failed to save order", { token });
			} finally {
				releaseSave();
			}
		},
		[acknowledgeSubmittedOrder, cart, intentVersion, refreshInventory, setLoading, setSuccess, setError],
	);

	return {
		saveControls,
		SaveButton,
		saveOrder,
		registerCartInteraction,
	};
}
