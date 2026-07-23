"use client";

import { Copy, ReceiptIndianRupee, Share2 } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

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
	const [isOpen, setIsOpen] = useState(false);
	const [orderButton, OrderButton] = useReactiveButton({
		label: "Copy Order",
		icon: Copy,
		loading: { label: "Copying...", icon: Copy },
		success: { label: "Copied", duration: 2000 },
		error: { label: "Copy failed" },
		feedbackStyle: "neutral",
	});
	const [qrButton, QrButton] = useReactiveButton({
		label: "Copy QR",
		icon: ReceiptIndianRupee,
		loading: { label: "Copying...", icon: ReceiptIndianRupee },
		success: { label: "Copied", duration: 2000 },
		error: { label: "Copy failed" },
		feedbackStyle: "neutral",
	});
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const { selectedAccount, selectedUpiId, setSelectedUpiId } = useSelectedUpiAccount(upiAccounts);

	const deliveryCostAmount = Number.parseFloat(deliveryCost || "0");
	const orderText = getOrderCopyText(cart, total, deliveryCostAmount);
	const upiPaymentText = selectedAccount ? getUpiPaymentText(total, cart, selectedAccount.upiId) : "";

	const copyOrderDetails = async () => {
		if (cart.length === 0 || orderButton.isBusy) return;
		const token = orderButton.setLoading();
		try {
			await navigator.clipboard.writeText(orderText);
			orderButton.setSuccess(undefined, { token });
		} catch (error) {
			if (!orderButton.setError("Copy failed", { token })) return;
			console.error("Failed to copy order:", error);
		}
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current || qrButton.isBusy) return;
		const token = qrButton.setLoading();
		try {
			await copyQrSvgToClipboard(qrCodeRef.current);
			qrButton.setSuccess(undefined, { token });
		} catch (error) {
			if (!qrButton.setError("Copy failed", { token })) return;
			console.error("Failed to copy QR:", error);
		}
	};

	return (
		<Popover
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) {
					orderButton.reset();
					qrButton.reset();
				}
			}}
		>
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
			{/* max-h-(--available-height) caps the popup to the space between the
				trigger and the viewport edge. Background stays on PopoverContent;
				scroll-fade on the scroller dissolves content into that surface. */}
			<PopoverContent side="top" align="end" className="w-72 max-h-(--available-height) overflow-hidden p-0">
				<div className="scroll-fade scroll-fade-12 max-h-(--available-height) overflow-y-auto overscroll-contain p-4">
					<div className="space-y-3">
						{/* Surface on the wrapper; scroll-fade on the pre so the mask
							fades text into bg-muted/50, not the rounded chrome. */}
						<div className="overflow-hidden rounded-lg bg-muted/50">
							<pre className="scroll-fade scroll-fade-8 max-h-40 overflow-y-auto whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed">
								{orderText}
							</pre>
						</div>

						<OrderButton
							render={<motion.button type="button" whileTap={{ scale: 0.97 }} />}
							onClick={copyOrderDetails}
							className={cn(
								"flex w-full items-center justify-center rounded-lg border py-2 px-3 text-xs font-medium transition-colors [&_svg]:size-3.5",
								"bg-muted/50 hover:bg-muted",
							)}
						/>

						{upiPaymentText && (
							<div className="flex flex-col items-center gap-2 border-t pt-3">
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
								<div className="rounded-lg bg-white p-2">
									<QRCodeSVG value={upiPaymentText} size={88} />
								</div>
								{/* Hidden 400px source keeps the copied QR high-res for scanning. */}
								<QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />
								<QrButton
									render={<motion.button type="button" whileTap={{ scale: 0.97 }} />}
									onClick={copyQrCode}
									className={cn(
										"flex w-full items-center justify-center rounded-lg border py-2 px-3 text-xs font-medium transition-colors [&_svg]:size-3.5",
										"bg-muted/50 hover:bg-muted",
									)}
								/>
							</div>
						)}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
