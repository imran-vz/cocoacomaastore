"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FEEDBACK_MS } from "@/components/ui/feedback";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { createOrder } from "@/features/orders/actions";
import {
	type CartLine,
	canAddOne,
	cartReducer,
	emptyCart,
	itemCount,
	remainingStock,
	type SellableCombo,
	type SellableDessert,
	type StockCounts,
	type TileKey,
	tileKeyOf,
} from "@/features/pos/cart";
import { createOrderSubmitter, deliveryFeeCents, orderTotalCents } from "@/features/pos/checkout";
import { useRunAction } from "@/lib/action-result";
import { formatINR, formatOrderNumber } from "@/lib/format";
import { rupees } from "@/lib/money";

function clearIfUnchanged(saved: string) {
	return (current: string) => (current === saved ? "" : current);
}

/**
 * The POS cart: its lines, the customer and delivery fields, the totals, and saving the order.
 * Cart surfaces only lay this out.
 */
export function usePosCart(stock: StockCounts) {
	const runAction = useRunAction();
	const [state, dispatch] = useReducer(cartReducer, emptyCart);
	const { lines, version } = state;
	const [customerName, setCustomerName] = useState("");
	const [deliveryCost, setDeliveryCost] = useState("");

	const deliveryCents = deliveryFeeCents(deliveryCost) ?? 0;
	const totalCents = orderTotalCents(lines, deliveryCents);

	const [saveControls, SaveButton] = useReactiveButton({
		label: lines.length === 0 ? "Add items to save" : `Save order · ${formatINR(rupees(totalCents))}`,
		loading: { label: "Saving order…" },
		success: { duration: FEEDBACK_MS.inline },
	});
	const { setLoading, setSuccess, setError, reset } = saveControls;
	const [submit] = useState(() =>
		createOrderSubmitter((input) =>
			runAction(createOrder(input), {
				fallback: "Couldn't save the order — check the connection and try again",
				refetch: "background",
			}),
		),
	);

	const versionRef = useRef(version);
	// Resolves the save waiting on its confirmation flash; an edit to the cart cuts the flash short.
	const confirmationRef = useRef<((closeable: boolean) => void) | null>(null);
	useEffect(() => {
		versionRef.current = version;
		confirmationRef.current?.(false);
		confirmationRef.current = null;
		reset({ ifStatus: "success" });
	}, [version, reset]);
	useEffect(() => () => confirmationRef.current?.(false), []);

	/**
	 * Saves the order. Resolves true once the saved order's confirmation has shown and the cashier has not
	 * changed the cart since it was sent: the moment a cart surface may close.
	 */
	const save = useCallback(async (): Promise<boolean> => {
		const draft = { lines, customerName, deliveryCost, intentVersion: state.intentVersion };
		const sending = submit(draft);
		if (!sending) return false;
		const sentAtVersion = version;
		const token = setLoading();

		const result = await sending;
		if (!result.ok) {
			setError(result.error, { token });
			return false;
		}

		const { orderId, replayed } = result.data;
		dispatch({ type: "acknowledge-save", savedLines: draft.lines });
		setCustomerName(clearIfUnchanged(draft.customerName));
		setDeliveryCost(clearIfUnchanged(draft.deliveryCost));

		return new Promise<boolean>((resolve) => {
			confirmationRef.current = resolve;
			const shown = setSuccess(`Order ${formatOrderNumber(orderId)} ${replayed ? "already saved" : "saved"}`, {
				token,
				onComplete: () => {
					confirmationRef.current = null;
					resolve(versionRef.current === sentAtVersion);
				},
			});
			if (!shown) resolve(false);
		});
	}, [lines, customerName, deliveryCost, state.intentVersion, version, submit, setLoading, setError, setSuccess]);

	const quantityByTile = useMemo(() => {
		const quantities = new Map<TileKey, number>();
		for (const line of lines) quantities.set(tileKeyOf(line), line.quantity);
		return quantities;
	}, [lines]);

	const addDessert = useCallback(
		(dessert: SellableDessert) => dispatch({ type: "add-dessert", dessert, stock }),
		[stock],
	);
	const addCombo = useCallback((combo: SellableCombo) => dispatch({ type: "add-combo", combo, stock }), [stock]);
	const stepLine = useCallback(
		(cartLineId: string, delta: 1 | -1) => dispatch({ type: "step-line", cartLineId, delta, stock }),
		[stock],
	);
	const removeLine = useCallback((cartLineId: string) => dispatch({ type: "remove-line", cartLineId }), []);
	const clear = useCallback(() => {
		dispatch({ type: "clear" });
		setCustomerName("");
		setDeliveryCost("");
	}, []);

	return {
		lines,
		version,
		rejection: state.rejection,
		itemCount: itemCount(lines),
		deliveryCents,
		totalCents,
		customerName,
		setCustomerName,
		deliveryCost,
		setDeliveryCost,
		SaveButton,
		save,
		quantityOf: (tile: TileKey) => quantityByTile.get(tile) ?? 0,
		/** Units of a dessert the cart can still take today. */
		remainingOf: (dessert: { id: number; hasUnlimitedStock: boolean }) => remainingStock(lines, dessert, stock),
		canAddOne: (line: CartLine) => canAddOne(lines, line, stock),
		addDessert,
		addCombo,
		stepLine,
		removeLine,
		clear,
	};
}

export type PosCart = ReturnType<typeof usePosCart>;
