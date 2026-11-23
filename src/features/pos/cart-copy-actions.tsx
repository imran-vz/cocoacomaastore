"use client";

import { Check, CircleAlert, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { FEEDBACK_MS } from "@/components/ui/feedback";
import { type ReactiveButtonConfig, useReactiveButton } from "@/components/ui/reactive-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { orderCopyText, upiPaymentLink } from "@/features/pos/checkout";
import type { CartDensity } from "@/features/pos/layout";
import { copyQrSvgToClipboard } from "@/features/pos/qr-code";
import { useSelectedUpiAccount } from "@/features/pos/upi-selection";
import type { PosCart } from "@/features/pos/use-pos-cart";
import type { CheckoutUpiAccount } from "@/features/upi/shapes";
import { cn } from "@/lib/utils";

const CopyIcon = ({ className }: { className?: string }) => <Copy className={cn("size-4", className)} />;
const QrIcon = ({ className }: { className?: string }) => <QrCode className={cn("size-4", className)} />;
const CheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-4", className)} />;
const AlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-4", className)} />;

function copyButtonConfig(label: string, icon: ReactiveButtonConfig["icon"]): ReactiveButtonConfig {
	return {
		label,
		icon,
		loading: { label: "Copying…", icon },
		success: { label: "Copied", icon: CheckIcon, duration: FEEDBACK_MS.copied },
		error: { label: "Failed", icon: AlertIcon },
	};
}

async function runCopy(button: ReturnType<typeof useReactiveButton>[0], copy: () => Promise<void>) {
	if (button.isBusy) return;
	const token = button.setLoading();
	try {
		await copy();
		button.setSuccess(undefined, { token });
	} catch (error) {
		console.error("Failed to copy:", error);
		button.setError(undefined, { token });
	}
}

type OrderChannel = "counter" | "online";

const CHANNEL_OPTIONS = [
	{ value: "counter", label: "In store" },
	{ value: "online", label: "Online order" },
] as const;

const groupLabelClass = "text-meta font-medium text-muted-foreground";

/**
 * Order type (In store by default, or Online order). An online order picks the UPI account to be paid
 * and offers the order text and a payment QR code to copy into the chat with the customer.
 */
export function CartCopyActions({
	cart,
	upiAccounts,
	density,
}: {
	cart: PosCart;
	upiAccounts: readonly CheckoutUpiAccount[];
	density: CartDensity;
}) {
	const [channel, setChannel] = useState<OrderChannel>("counter");
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const [orderButton, OrderButton] = useReactiveButton(copyButtonConfig("Copy order", CopyIcon));
	const [qrButton, QrButton] = useReactiveButton(copyButtonConfig("Copy QR", QrIcon));
	const { selected, select } = useSelectedUpiAccount(upiAccounts);

	const paymentLink = selected ? upiPaymentLink(selected.upiId, cart.totalCents, cart.lines) : "";
	const size = density === "compact" ? "sm" : "default";

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
				/>
			</div>

			{channel === "online" && (
				<div className="space-y-1.5">
					{upiAccounts.length > 1 ? (
						<>
							<p aria-hidden="true" className={groupLabelClass}>
								UPI account
							</p>
							<SegmentedControl
								aria-label="UPI account"
								options={upiAccounts.map((account) => ({ value: account.id, label: account.label }))}
								value={selected?.id ?? ""}
								onValueChange={select}
								size={size}
							/>
						</>
					) : selected ? (
						<p className="flex items-baseline justify-between gap-3 text-sm">
							<span className="text-meta text-muted-foreground">UPI account</span>
							<span className="truncate font-semibold text-foreground">{selected.label}</span>
						</p>
					) : null}

					<div className="grid grid-cols-2 gap-2">
						<OrderButton
							onClick={() =>
								runCopy(orderButton, () => navigator.clipboard.writeText(orderCopyText(cart.lines, cart.deliveryCents)))
							}
							variant="ghost"
							size={size}
							className="w-full text-muted-foreground hover:text-foreground"
						/>
						<QrButton
							onClick={() =>
								runCopy(qrButton, async () => {
									if (qrCodeRef.current) await copyQrSvgToClipboard(qrCodeRef.current);
								})
							}
							disabled={!paymentLink}
							variant="ghost"
							size={size}
							className="w-full text-muted-foreground hover:text-foreground"
						/>
					</div>

					{paymentLink && <QRCodeSVG ref={qrCodeRef} value={paymentLink} size={400} className="hidden" />}
				</div>
			)}
		</div>
	);
}
