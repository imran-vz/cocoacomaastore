"use client";

import { Check, Copy, ReceiptIndianRupee, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useSelectedUpiAccount } from "@/components/use-selected-upi-account";
import type { UpiAccount } from "@/db/schema";
import { copyQrSvgToClipboard } from "@/lib/copy-qr-to-clipboard";
import { getOrderCopyText, getUpiPaymentText } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const TOAST_STYLE = { "--toast-duration": "1000ms" } as React.CSSProperties;

export function CartSharePopover({
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
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const { selectedAccount, selectedUpiId, setSelectedUpiId } = useSelectedUpiAccount(upiAccounts);

	// Scroll shadows: fade the top/bottom edge only while there is more order
	// text to scroll toward in that direction.
	const [showTopShadow, setShowTopShadow] = useState(false);
	const [showBottomShadow, setShowBottomShadow] = useState(false);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);

	const updateShadows = useCallback((element: HTMLElement) => {
		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopShadow(scrollTop > 1);
		setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 1);
	}, []);

	const attachOrderText = useCallback(
		(element: HTMLPreElement | null) => {
			resizeObserverRef.current?.disconnect();
			if (!element) return;
			// ResizeObserver fires once observation starts, giving a reliable
			// first measurement when the popover mounts this element.
			const observer = new ResizeObserver(() => updateShadows(element));
			observer.observe(element);
			resizeObserverRef.current = observer;
		},
		[updateShadows],
	);

	const deliveryCostAmount = Number.parseFloat(deliveryCost || "0");
	const orderText = getOrderCopyText(cart, total, deliveryCostAmount);
	const upiPaymentText = selectedAccount ? getUpiPaymentText(total, cart, selectedAccount.upiId) : "";

	const copyOrderDetails = async () => {
		if (cart.length === 0) return;
		await navigator.clipboard.writeText(orderText);
		setCopiedOrder(true);
		toast.info("Order copied!", { duration: 1000, style: TOAST_STYLE });
		setTimeout(() => setCopiedOrder(false), 2000);
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current) return;
		try {
			await copyQrSvgToClipboard(qrCodeRef.current);
			setCopiedQr(true);
			toast.info("QR copied!", { duration: 1000, style: TOAST_STYLE });
			setTimeout(() => setCopiedQr(false), 2000);
		} catch (error) {
			console.error("Failed to copy QR:", error);
			toast.error("Failed to copy QR code");
		}
	};

	return (
		<Popover>
			<PopoverTrigger
				render={
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						aria-label="Share order"
						className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<Share2 className="size-5" />
					</motion.button>
				}
			/>
			<PopoverContent side="top" align="end" className="w-72">
				<div className="space-y-3">
					{upiAccounts.length > 1 && (
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
					)}

					<div className="relative">
						<pre
							ref={attachOrderText}
							onScroll={(event) => updateShadows(event.currentTarget)}
							className="max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed"
						>
							{orderText}
						</pre>
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-lg bg-linear-to-b from-foreground/15 to-transparent transition-opacity duration-200",
								showTopShadow ? "opacity-100" : "opacity-0",
							)}
						/>
						<div
							aria-hidden
							className={cn(
								"pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-lg bg-linear-to-t from-foreground/15 to-transparent transition-opacity duration-200",
								showBottomShadow ? "opacity-100" : "opacity-0",
							)}
						/>
					</div>

					<motion.button
						type="button"
						whileTap={{ scale: 0.97 }}
						onClick={copyOrderDetails}
						className={cn(
							"flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-medium transition-colors",
							copiedOrder ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
						)}
					>
						{copiedOrder ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
						<span>{copiedOrder ? "Copied!" : "Copy Order"}</span>
					</motion.button>

					{upiPaymentText && (
						<div className="flex flex-col items-center gap-2 border-t pt-3">
							<div className="rounded-lg bg-white p-2">
								<QRCodeSVG value={upiPaymentText} size={120} />
							</div>
							{/* Hidden 400px source keeps the copied QR high-res for scanning. */}
							<QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />
							<motion.button
								type="button"
								whileTap={{ scale: 0.97 }}
								onClick={copyQrCode}
								className={cn(
									"flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-medium transition-colors",
									copiedQr ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
								)}
							>
								{copiedQr ? <Check className="size-3.5" /> : <ReceiptIndianRupee className="size-3.5" />}
								<span>{copiedQr ? "Copied!" : "Copy QR"}</span>
							</motion.button>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
