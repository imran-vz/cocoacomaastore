"use client";

import { XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverDescription,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useReactiveButton } from "@/components/ui/reactive-button";
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

export function OrderCancelAction({
	order,
	onCancelOrder,
}: {
	order: OrderViewModel;
	onCancelOrder: CancelOrderHandler;
}) {
	const [isCancelPopoverOpen, setIsCancelPopoverOpen] = useState(false);
	const [cancelReason, setCancelReason] = useState("");
	const cancelReasonInputRef = useRef<HTMLInputElement>(null);
	const cancelTriggerRef = useRef<HTMLButtonElement>(null);

	const [cancelButton, CancelButton] = useReactiveButton({
		label: "Cancel Order",
		loading: { label: "Cancelling..." },
		success: { label: "Cancelled", duration: 900 },
	});

	// Loading (mid-cancel) and the brief success flash both hold the popover open;
	// success auto-closes it via onComplete below.
	const isBusy = cancelButton.status !== "idle";

	const handleCancelPopoverOpenChange = (open: boolean) => {
		if (isBusy && !open) {
			return;
		}

		setIsCancelPopoverOpen(open);
		if (!open) {
			setCancelReason("");
		}
	};

	const handleCancelOrder = async () => {
		const token = cancelButton.setLoading();
		try {
			await onCancelOrder(order.id, cancelReason.trim() || undefined);
			cancelButton.setSuccess("Cancelled", {
				token,
				duration: 900,
				onComplete: () => {
					setIsCancelPopoverOpen(false);
					setCancelReason("");
				},
			});
		} catch (error) {
			console.error(error);
			cancelButton.setError("Cancellation failed", { token });
		}
	};

	return (
		<Popover open={isCancelPopoverOpen} onOpenChange={handleCancelPopoverOpenChange} modal="trap-focus">
			<PopoverTrigger
				ref={cancelTriggerRef}
				disabled={isBusy}
				render={
					<Button variant="destructive" size="sm" className="h-11 w-full md:h-8">
						<XCircle className="size-4" />
						Cancel Order
					</Button>
				}
			/>

			<PopoverContent
				align="end"
				side="top"
				sideOffset={8}
				initialFocus={cancelReasonInputRef}
				finalFocus={cancelTriggerRef}
				className="max-h-(--available-height) w-[min(22rem,calc(100vw-2rem))] overflow-y-auto p-0"
			>
				<div className="space-y-2 p-4">
					<PopoverTitle>Cancel Order #{order.id}</PopoverTitle>
					<PopoverDescription>
						Are you sure you want to cancel this order? The inventory will be restored automatically.
					</PopoverDescription>
				</div>

				<div className="border-t px-4 py-3">
					<div className="space-y-2">
						<Label htmlFor={`cancel-reason-${order.id}`}>Reason (optional)</Label>
						<Input
							ref={cancelReasonInputRef}
							id={`cancel-reason-${order.id}`}
							list={`cancel-reasons-${order.id}`}
							placeholder="Select or type a reason..."
							value={cancelReason}
							maxLength={MAX_ORDER_CANCELLATION_REASON_LENGTH}
							onChange={(event) => setCancelReason(event.target.value)}
							disabled={cancelButton.isBusy}
						/>
						<datalist id={`cancel-reasons-${order.id}`}>
							{CANCELLATION_REASONS.map((reason) => (
								<option key={reason} value={reason} />
							))}
						</datalist>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2 rounded-b-xl border-t bg-muted/50 p-3">
					<PopoverClose
						disabled={isBusy}
						render={
							<Button variant="outline" className="w-full">
								Keep Order
							</Button>
						}
					/>
					<CancelButton variant="destructive" onClick={handleCancelOrder} />
				</div>
			</PopoverContent>
		</Popover>
	);
}
