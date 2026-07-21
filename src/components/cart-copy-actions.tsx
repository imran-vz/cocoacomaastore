"use client";

import { Check, ChevronDown, CircleAlert, Copy, ReceiptIndianRupee } from "lucide-react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { useSelectedUpiAccount } from "@/components/use-selected-upi-account";
import type { UpiAccount } from "@/db/schema";
import { copyQrSvgToClipboard } from "@/lib/copy-qr-to-clipboard";
import { getOrderCopyText, getUpiPaymentText } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";

const CopyIcon = ({ className }: { className?: string }) => <Copy className={cn("size-3.5", className)} />;
const RupeeIcon = ({ className }: { className?: string }) => (
	<ReceiptIndianRupee className={cn("size-3.5", className)} />
);
const CheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-3.5", className)} />;
const AlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-3.5", className)} />;

const buttonHostClass = cn(
	"flex items-center justify-center rounded-lg border py-2 px-3 text-xs font-medium transition-colors",
	"bg-muted/50 hover:bg-muted",
);

export function CartCopyActions({
	cart,
	total,
	deliveryCost,
	upiAccounts,
}: {
	cart: CartLine[];
	total: number;
	deliveryCost: string;
	upiAccounts: UpiAccount[];
}) {
	const [isOpen, setIsOpen] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const [orderButton, OrderButton] = useReactiveButton({
		label: "Copy Order",
		icon: CopyIcon,
		loading: { label: "Copying...", icon: CopyIcon },
		success: { label: "Copied", icon: CheckIcon, duration: 2000 },
		error: { label: "Failed", icon: AlertIcon },
		feedbackStyle: "neutral",
	});
	const [qrButton, QrButton] = useReactiveButton({
		label: "Copy QR",
		icon: RupeeIcon,
		loading: { label: "Copying...", icon: RupeeIcon },
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

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
			>
				<span className="font-medium">Online Order (Instagram)</span>
				<ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} />
			</button>
			<div
				inert={!isOpen}
				className={cn(
					"grid transition-[grid-template-rows,opacity] duration-200 ease-out",
					isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
				)}
			>
				<div className="overflow-hidden">
					<div className="space-y-2 pt-2">
						{upiAccounts.length > 1 && (
							<div className="px-1">
								<select
									value={selectedUpiId}
									onChange={(event) => setSelectedUpiId(event.target.value)}
									className="w-full text-xs border rounded-lg px-2 py-1.5 bg-muted"
								>
									{upiAccounts.map((account) => (
										<option key={account.id} value={account.id.toString()}>
											{account.label}
										</option>
									))}
								</select>
							</div>
						)}

						<div className="grid grid-cols-2 gap-2">
							<OrderButton
								onClick={copyOrderDetails}
								render={<motion.button type="button" whileTap={{ scale: 0.95 }} className={buttonHostClass} />}
							/>

							<QrButton
								onClick={copyQrCode}
								disabled={!upiPaymentText}
								className={cn(!upiPaymentText && "opacity-50")}
								render={<motion.button type="button" whileTap={{ scale: 0.95 }} className={buttonHostClass} />}
							/>
						</div>

						{upiPaymentText && <QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />}
					</div>
				</div>
			</div>
		</div>
	);
}
