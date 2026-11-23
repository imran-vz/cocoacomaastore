"use client";

import { Check, CircleAlert, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSelectedUpiAccount } from "@/components/use-selected-upi-account";
import type { UpiAccount } from "@/db/schema";
import { copyQrSvgToClipboard } from "@/lib/copy-qr-to-clipboard";
import { getOrderCopyText, getUpiPaymentText } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";

const CopyIcon = ({ className }: { className?: string }) => <Copy className={cn("size-4", className)} />;
const QrIcon = ({ className }: { className?: string }) => <QrCode className={cn("size-4", className)} />;
const CheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-4", className)} />;
const AlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-4", className)} />;

type OrderChannel = "counter" | "online";

const groupLabelClass = "text-[13px] leading-[18px] font-medium text-muted-foreground";

const CHANNEL_OPTIONS = [
	{ value: "counter", label: "In store" },
	{ value: "online", label: "Online order" },
] as const;

/**
 * Order controls for the cart (DESIGN.md decision 14, round-2 decision 11). One control type throughout:
 *
 * - "Order type": In store (default) | Online order — the same two states the old "Online Order (Instagram)"
 *   collapsible had, closed by default. A visible label names the group; it is not a tender choice.
 * - Online: "UPI account" (a segmented row when there is more than one account, the account's
 *   name otherwise), then directly below it "Copy order" and "Copy QR". Copy text and QR
 *   payload come unchanged from `pos-cart-behaviour`.
 *
 * `compact` is the inline (tablet/desktop) cart: 36px segments from md up.
 */
export function CartCopyActions({
	cart,
	total,
	deliveryCost,
	upiAccounts,
	compact = false,
}: {
	cart: CartLine[];
	total: number;
	deliveryCost: string;
	upiAccounts: UpiAccount[];
	compact?: boolean;
}) {
	const [channel, setChannel] = useState<OrderChannel>("counter");
	const isOnline = channel === "online";
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const [orderButton, OrderButton] = useReactiveButton({
		label: "Copy order",
		icon: CopyIcon,
		loading: { label: "Copying…", icon: CopyIcon },
		success: { label: "Copied", icon: CheckIcon, duration: 2000 },
		error: { label: "Failed", icon: AlertIcon },
		feedbackStyle: "neutral",
	});
	const [qrButton, QrButton] = useReactiveButton({
		label: "Copy QR",
		icon: QrIcon,
		loading: { label: "Copying…", icon: QrIcon },
		success: { label: "Copied", icon: CheckIcon, duration: 2000 },
		error: { label: "Failed", icon: AlertIcon },
		feedbackStyle: "neutral",
	});
	const { selectedAccount, selectedUpiId, setSelectedUpiId } = useSelectedUpiAccount(upiAccounts);

	const upiPaymentText = selectedAccount ? getUpiPaymentText(total, cart, selectedAccount.upiId) : "";

	const copyOrderDetails = async () => {
		if (cart.length === 0 || orderButton.isBusy) return;
		const token = orderButton.setLoading();
		try {
			const deliveryCostAmount = Number.parseFloat(deliveryCost || "0");
			await navigator.clipboard.writeText(getOrderCopyText(cart, total, deliveryCostAmount));
			orderButton.setSuccess(undefined, { token, duration: 2000 });
		} catch (error) {
			console.error("Failed to copy order:", error);
			orderButton.setError("Failed", { token });
		}
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current || qrButton.isBusy) return;
		const token = qrButton.setLoading();
		try {
			await copyQrSvgToClipboard(qrCodeRef.current);
			qrButton.setSuccess(undefined, { token, duration: 2000 });
		} catch (error) {
			console.error("Failed to copy QR:", error);
			qrButton.setError("Failed", { token });
		}
	};

	const size = compact ? "sm" : "default";

	return (
		<div className="space-y-3">
			<div className="space-y-1.5">
				<p aria-hidden="true" className={groupLabelClass}>
					Order type
				</p>
				<SegmentedControl
					aria-label="Order type"
					options={CHANNEL_OPTIONS}
					value={channel}
					onValueChange={setChannel}
					size={size}
					fullWidth
				/>
			</div>

			{isOnline && (
				<div className="space-y-1.5">
					{upiAccounts.length > 1 ? (
						<>
							<p aria-hidden="true" className={groupLabelClass}>
								UPI account
							</p>
							<SegmentedControl
								aria-label="UPI account"
								options={upiAccounts.map((account) => ({ value: account.id.toString(), label: account.label }))}
								value={selectedUpiId}
								onValueChange={setSelectedUpiId}
								size={size}
								fullWidth
							/>
						</>
					) : selectedAccount ? (
						<p className="flex items-baseline justify-between gap-3 text-sm">
							<span className="text-[13px] text-muted-foreground">UPI account</span>
							<span className="truncate font-semibold text-foreground">{selectedAccount.label}</span>
						</p>
					) : null}

					<div className="grid grid-cols-2 gap-2">
						<OrderButton
							onClick={copyOrderDetails}
							variant="ghost"
							size={compact ? "sm" : "default"}
							className="w-full text-muted-foreground hover:text-foreground"
						/>
						<QrButton
							onClick={copyQrCode}
							disabled={!upiPaymentText}
							variant="ghost"
							size={compact ? "sm" : "default"}
							className="w-full text-muted-foreground hover:text-foreground"
						/>
					</div>

					{upiPaymentText && <QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />}
				</div>
			)}
		</div>
	);
}
