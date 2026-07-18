"use client";

import { Check, ChevronDown, Copy, ReceiptIndianRupee } from "lucide-react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSelectedUpiAccount } from "@/components/use-selected-upi-account";
import type { UpiAccount } from "@/db/schema";
import { copyQrSvgToClipboard } from "@/lib/copy-qr-to-clipboard";
import { getOrderCopyText, getUpiPaymentText } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";

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
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const { selectedAccount, selectedUpiId, setSelectedUpiId } = useSelectedUpiAccount(upiAccounts);

	const upiPaymentText = selectedAccount ? getUpiPaymentText(total, cart, selectedAccount.upiId) : "";

	const copyOrderDetails = async () => {
		if (cart.length === 0) return;
		const deliveryCostAmount = Number.parseFloat(deliveryCost || "0");
		await navigator.clipboard.writeText(getOrderCopyText(cart, total, deliveryCostAmount));
		setCopiedOrder(true);
		toast.info("Order copied!", { duration: 1000 });
		setTimeout(() => setCopiedOrder(false), 2000);
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current) return;
		try {
			await copyQrSvgToClipboard(qrCodeRef.current);
			setCopiedQr(true);
			toast.info("QR copied!", { duration: 1000 });
			setTimeout(() => setCopiedQr(false), 2000);
		} catch (error) {
			console.error("Failed to copy QR:", error);
			toast.error("Failed to copy QR code");
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
							<motion.button
								type="button"
								whileTap={{ scale: 0.95 }}
								onClick={copyOrderDetails}
								className={cn(
									"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors",
									copiedOrder ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
								)}
							>
								{copiedOrder ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
								<span>{copiedOrder ? "Copied!" : "Copy Order"}</span>
							</motion.button>

							<motion.button
								type="button"
								whileTap={{ scale: 0.95 }}
								onClick={copyQrCode}
								disabled={!upiPaymentText}
								className={cn(
									"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors",
									copiedQr ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
									!upiPaymentText && "opacity-50",
								)}
							>
								{copiedQr ? <Check className="size-3.5" /> : <ReceiptIndianRupee className="size-3.5" />}
								<span>{copiedQr ? "Copied!" : "Copy QR"}</span>
							</motion.button>
						</div>

						{upiPaymentText && <QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />}
					</div>
				</div>
			</div>
		</div>
	);
}
