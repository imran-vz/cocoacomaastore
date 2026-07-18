"use client";

import { Check, Copy, ReceiptIndianRupee } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { UpiAccount } from "@/db/schema";
import { copyQrSvgToClipboard } from "@/lib/copy-qr-to-clipboard";
import { getReceiptCopyText, getReceiptUpiPaymentText, type OrderSaveAcknowledgement } from "@/lib/pos-cart-behaviour";
import { useUpiStore } from "@/store/upi-store";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Separator } from "./ui/separator";

function formatMoney(cents: number) {
	return `₹${(cents / 100).toFixed(2)}`;
}

const stagger: Variants = {
	hidden: { opacity: 0, y: 8 },
	show: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { delay: 0.05 * i, duration: 0.25, ease: "easeOut" },
	}),
};

export function CompletedOrderReceiptDialog({
	acknowledgement,
	upiAccounts,
	onClose,
}: {
	acknowledgement: OrderSaveAcknowledgement | null;
	upiAccounts: UpiAccount[];
	onClose: () => void;
}) {
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const { selectedUpiId, setSelectedUpiId } = useUpiStore();
	const receipt = acknowledgement?.receipt;

	useEffect(() => {
		const isValid = upiAccounts.some((account) => account.id.toString() === selectedUpiId);
		if (!isValid && upiAccounts.length > 0) setSelectedUpiId(upiAccounts[0].id.toString());
	}, [selectedUpiId, setSelectedUpiId, upiAccounts]);

	const selectedAccount = upiAccounts.find((account) => account.id.toString() === selectedUpiId) ?? upiAccounts[0];
	const upiPaymentText = receipt && selectedAccount ? getReceiptUpiPaymentText(receipt, selectedAccount.upiId) : "";

	const handleClose = () => {
		setCopiedOrder(false);
		setCopiedQr(false);
		onClose();
	};

	const copyOrderDetails = async () => {
		if (!receipt) return;
		await navigator.clipboard.writeText(getReceiptCopyText(receipt));
		setCopiedOrder(true);
		toast.info("Saved receipt copied!", { duration: 1000 });
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current) return;
		try {
			await copyQrSvgToClipboard(qrCodeRef.current);
			setCopiedQr(true);
			toast.info("Saved payment QR copied!", { duration: 1000 });
		} catch (error) {
			console.error("Failed to copy saved receipt QR:", error);
			toast.error("Failed to copy QR code");
		}
	};

	return (
		<Dialog open={receipt !== undefined} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
				{receipt && (
					<>
						<DialogHeader>
							<div className="flex items-center gap-2">
								<motion.span
									initial={{ scale: 0.9, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
									className="grid size-6 shrink-0 place-items-center rounded-full bg-green-500 text-white"
								>
									<Check className="size-4" />
								</motion.span>
								<DialogTitle>Order #{receipt.id} saved</DialogTitle>
							</div>
							<DialogDescription>
								{acknowledgement?.replayed
									? "This is the original saved receipt for the retried order."
									: "Pricing and item details below were resolved and saved by the server."}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3">
							<motion.div variants={stagger} initial="hidden" animate="show" custom={0}>
								<div className="text-sm">
									<p className="font-medium">{receipt.customerName}</p>
									<p className="text-xs text-muted-foreground">{new Date(receipt.createdAt).toLocaleString("en-IN")}</p>
								</div>
							</motion.div>
							<Separator />
							<motion.div variants={stagger} initial="hidden" animate="show" custom={1}>
								<div className="space-y-2">
									{receipt.lines.map((line) => (
										<div key={line.id} className="flex justify-between gap-4 text-sm">
											<div>
												<p className="font-medium">
													{line.name} × {line.quantity}
												</p>
												{line.details && <p className="text-xs text-muted-foreground">{line.details}</p>}
											</div>
											<span className="font-medium tabular-nums">{formatMoney(line.lineTotalCents)}</span>
										</div>
									))}
								</div>
							</motion.div>
							<motion.div variants={stagger} initial="hidden" animate="show" custom={2} className="space-y-3">
								<Separator />
								<div className="space-y-1 text-sm">
									<div className="flex justify-between">
										<span>Subtotal</span>
										<span>{formatMoney(receipt.subtotalCents)}</span>
									</div>
									{receipt.deliveryCents > 0 && (
										<div className="flex justify-between">
											<span>Delivery</span>
											<span>{formatMoney(receipt.deliveryCents)}</span>
										</div>
									)}
									<div className="flex justify-between text-base font-bold">
										<span>Total</span>
										<span>{formatMoney(receipt.totalCents)}</span>
									</div>
								</div>
							</motion.div>

							<motion.div variants={stagger} initial="hidden" animate="show" custom={3} className="space-y-3">
								{upiAccounts.length > 1 && (
									<select
										value={selectedUpiId}
										onChange={(event) => setSelectedUpiId(event.target.value)}
										className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
									>
										{upiAccounts.map((account) => (
											<option key={account.id} value={account.id.toString()}>
												{account.label}
											</option>
										))}
									</select>
								)}
								{upiPaymentText ? (
									<div className="flex justify-center rounded-xl bg-white p-3">
										<QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={180} />
									</div>
								) : (
									<p className="text-center text-xs text-muted-foreground">No enabled UPI account is available.</p>
								)}
							</motion.div>
						</div>

						<DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<Button variant="outline" onClick={copyOrderDetails}>
								{copiedOrder ? <Check className="size-4" /> : <Copy className="size-4" />}
								{copiedOrder ? "Copied" : "Copy receipt"}
							</Button>
							<Button variant="outline" onClick={copyQrCode} disabled={!upiPaymentText}>
								{copiedQr ? <Check className="size-4" /> : <ReceiptIndianRupee className="size-4" />}
								{copiedQr ? "Copied" : "Copy QR"}
							</Button>
							<Button onClick={handleClose}>Done</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
