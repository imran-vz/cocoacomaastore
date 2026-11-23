"use client";

import { XCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_ORDER_CANCELLATION_REASON_LENGTH } from "@/lib/order-limits";
import type { OrderViewModel } from "./orders-view-model";

export type CancelOrderHandler = (orderId: number, reason?: string) => Promise<void>;

const CANCELLATION_REASONS = [
	"Customer requested cancellation",
	"Out of stock",
	"Duplicate order",
	"Wrong order placed",
	"Payment issue",
];

const NO_REASON = "none";
const OTHER_REASON = "other";

const REASON_LABELS: Record<string, string> = {
	[NO_REASON]: "No reason",
	[OTHER_REASON]: "Other…",
	...Object.fromEntries(CANCELLATION_REASONS.map((reason) => [reason, reason])),
};

/** The order row's toggle, found again once this action unmounts (the order is now cancelled). */
function findOrderToggle(orderId: number): HTMLElement | null {
	const toggles = document.querySelectorAll<HTMLElement>(`[data-order-toggle="${orderId}"]`);
	return Array.from(toggles).find((element) => element.offsetParent !== null) ?? null;
}

/**
 * "Cancel order" opens the shared `ConfirmSheet` (decision 2): a bottom sheet on phones, an
 * alert dialog from md, focus on "Keep order". The optional reason is the shared Select (the
 * preset reasons, or "Other…" for a typed one), so the cancellation call is unchanged.
 */
export function OrderCancelAction({
	order,
	onCancelOrder,
}: {
	order: OrderViewModel;
	onCancelOrder: CancelOrderHandler;
}) {
	const [open, setOpen] = useState(false);
	const [reasonChoice, setReasonChoice] = useState(NO_REASON);
	const [otherReason, setOtherReason] = useState("");
	const triggerWrapRef = useRef<HTMLSpanElement>(null);
	const reasonId = useId();
	const otherReasonId = useId();

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setReasonChoice(NO_REASON);
			setOtherReason("");
		}
	};

	const reason = reasonChoice === OTHER_REASON ? otherReason.trim() : reasonChoice === NO_REASON ? "" : reasonChoice;

	const handleConfirm = async () => {
		try {
			await onCancelOrder(order.id, reason || undefined);
		} catch (error) {
			console.error(error);
			throw new Error("Couldn't cancel the order. Try again.");
		}
	};

	return (
		<>
			<span ref={triggerWrapRef} className="contents">
				<Button variant="destructive-ghost" className="flex-1 md:flex-none" onClick={() => handleOpenChange(true)}>
					<XCircle aria-hidden="true" />
					Cancel order
				</Button>
			</span>

			<ConfirmSheet
				open={open}
				onOpenChange={handleOpenChange}
				title={`Cancel order ${order.orderLabel}?`}
				description={`${order.totalLabel} · ${order.itemsLabel}. The items go back into today's stock.`}
				confirmLabel="Cancel order"
				pendingLabel="Cancelling…"
				cancelLabel="Keep order"
				onConfirm={handleConfirm}
				// After a cancel this button is gone, so focus returns to the order's row.
				finalFocus={() => triggerWrapRef.current?.querySelector("button") ?? findOrderToggle(order.id) ?? true}
			>
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor={reasonId}>Reason (optional)</Label>
						<Select value={reasonChoice} onValueChange={(value) => setReasonChoice(String(value ?? NO_REASON))}>
							<SelectTrigger id={reasonId} className="w-full">
								<SelectValue>{(value: string) => REASON_LABELS[value] ?? value}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_REASON}>No reason</SelectItem>
								{CANCELLATION_REASONS.map((option) => (
									<SelectItem key={option} value={option}>
										{option}
									</SelectItem>
								))}
								<SelectItem value={OTHER_REASON}>Other…</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{reasonChoice === OTHER_REASON ? (
						<div className="space-y-1.5">
							<Label htmlFor={otherReasonId}>Other reason</Label>
							<Input
								id={otherReasonId}
								autoComplete="off"
								value={otherReason}
								maxLength={MAX_ORDER_CANCELLATION_REASON_LENGTH}
								onChange={(event) => setOtherReason(event.target.value)}
							/>
						</div>
					) : null}
				</div>
			</ConfirmSheet>
		</>
	);
}
