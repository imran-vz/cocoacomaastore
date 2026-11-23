"use client";

import { XCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FindOrderToggle } from "@/features/orders/cocoa-daybook";
import { type CancelOrderHandler, MAX_ORDER_CANCELLATION_REASON_LENGTH } from "@/features/orders/contract";
import type { OrderView } from "@/features/orders/presentation";

const NO_REASON = "none";
const OTHER_REASON = "other";

const REASON_OPTIONS = [
	{ value: NO_REASON, label: "No reason" },
	...["Customer requested cancellation", "Out of stock", "Duplicate order", "Wrong order placed", "Payment issue"].map(
		(reason) => ({ value: reason, label: reason }),
	),
	{ value: OTHER_REASON, label: "Other…" },
];

function reasonLabel(value: string) {
	return REASON_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** "Cancel order" asks for confirmation with an optional reason: a preset one, or "Other…" to type one. */
export function OrderCancelAction({
	order,
	onCancelOrder,
	findToggle,
}: {
	order: OrderView;
	onCancelOrder: CancelOrderHandler;
	findToggle: FindOrderToggle;
}) {
	const [open, setOpen] = useState(false);
	const [reasonChoice, setReasonChoice] = useState(NO_REASON);
	const [otherReason, setOtherReason] = useState("");
	const triggerRef = useRef<HTMLButtonElement>(null);
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

	const handleConfirm = () => onCancelOrder(order.id, reason || undefined);

	return (
		<>
			<Button
				ref={triggerRef}
				variant="destructive-ghost"
				className="flex-1 md:flex-none"
				onClick={() => handleOpenChange(true)}
			>
				<XCircle aria-hidden="true" />
				Cancel order
			</Button>

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
				finalFocus={() => triggerRef.current ?? findToggle() ?? true}
			>
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label htmlFor={reasonId}>Reason (optional)</Label>
						<Select value={reasonChoice} onValueChange={(value) => setReasonChoice(String(value ?? NO_REASON))}>
							<SelectTrigger id={reasonId} className="w-full">
								<SelectValue>{reasonLabel}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{REASON_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
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
