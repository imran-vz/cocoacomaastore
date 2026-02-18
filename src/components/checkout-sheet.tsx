"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Loader2, ReceiptIndianRupee, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { UpiAccount } from "@/db/schema";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUpiStore } from "@/store/upi-store";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface CheckoutSheetProps {
	isOpen: boolean;
	onClose: () => void;
	cart: CartLine[];
	total: number;
	deliveryCost: number;
	customerName: string;
	upiAccounts: UpiAccount[];
	onOrderSaved: () => void | Promise<void>;
	clearCart: () => void;
}

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function getUPIString(total: number, lines: CartLine[], upiId: string): string {
	const transactionNote = `${lines
		.map((line) => line.comboName ?? line.baseDessertName)
		.join(", ")
		.slice(0, 60)}...`;

	const params = new URLSearchParams();
	params.set("am", total.toString());
	params.set("pn", "Cocoa Comaa");
	params.set("tn", transactionNote);

	return `upi://pay?pa=${upiId}&${params.toString()}`;
}

export function CheckoutSheet({
	isOpen,
	onClose,
	cart,
	total,
	deliveryCost,
	customerName,
	upiAccounts,
	onOrderSaved,
	clearCart,
}: CheckoutSheetProps) {
	const { selectedUpiId, setSelectedUpiId } = useUpiStore();
	const [isSaving, setIsSaving] = useState(false);
	const [orderSaved, setOrderSaved] = useState(false);
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);

	// Initialize with first available account
	useEffect(() => {
		const isValid = upiAccounts.some(
			(account) => account.id.toString() === selectedUpiId,
		);
		if (!isValid && upiAccounts.length > 0) {
			setSelectedUpiId(upiAccounts[0].id.toString());
		}
	}, [upiAccounts, selectedUpiId, setSelectedUpiId]);

	const selectedAccount = upiAccounts.find(
		(account) => account.id.toString() === selectedUpiId,
	);

	const UPI_STRING = getUPIString(
		total,
		cart,
		selectedAccount?.upiId || upiAccounts[0]?.upiId || "",
	);

	const handleSaveOrder = async () => {
		if (cart.length === 0 || isSaving) return;

		try {
			setIsSaving(true);
			await createOrderWithLines({
				customerName: customerName.trim(),
				lines: cart,
				deliveryCost: deliveryCost.toFixed(2),
			});
			setOrderSaved(true);
			toast.success("Order saved successfully!");
			await onOrderSaved();

			// Auto close after a short delay
			setTimeout(() => {
				clearCart();
				onClose();
				setOrderSaved(false);
			}, 1500);
		} catch (err) {
			console.error("Failed to create order:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save order");
		} finally {
			setIsSaving(false);
		}
	};

	const copyOrderDetails = async () => {
		if (cart.length === 0) return;

		const orderItemsText = cart
			.map((line) => {
				const displayName = line.comboName ?? line.baseDessertName;
				const modifierText =
					line.modifiers.length > 0 && !line.comboName
						? ` (+ ${line.modifiers.map((m) => (m.quantity > 1 ? `${m.quantity}× ${m.name}` : m.name)).join(", ")})`
						: "";
				return `${capitalize(displayName.trim())}${modifierText} × ${line.quantity} = ₹${(line.unitPrice * line.quantity).toFixed(2)}`;
			})
			.join("\n");

		const deliveryLine =
			deliveryCost > 0 ? `\nDelivery: ₹${deliveryCost.toFixed(2)}` : "";
		const orderText = `${orderItemsText}${deliveryLine}\n------\nTotal: ₹${total.toFixed(2)}`;

		await navigator.clipboard.writeText(orderText);
		setCopiedOrder(true);
		toast.info("Order copied!", { duration: 1000 });
		setTimeout(() => setCopiedOrder(false), 2000);
	};

	const getQrCodeDataUrl = async (): Promise<string> => {
		if (!qrCodeRef.current) return "";

		const svgData = new XMLSerializer().serializeToString(qrCodeRef.current);
		const svgBlob = new Blob([svgData], {
			type: "image/svg+xml;charset=utf-8",
		});
		const url = URL.createObjectURL(svgBlob);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		const img = new Image(400, 400);

		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = url;
		});

		const padding = 48;
		canvas.width = img.width + padding * 2;
		canvas.height = img.height + padding * 2;

		if (ctx) {
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, padding, padding);
		}

		URL.revokeObjectURL(url);
		return canvas.toDataURL("image/png");
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current) return;

		try {
			const dataUrl = await getQrCodeDataUrl();
			const response = await fetch(dataUrl);
			const blob = await response.blob();

			await navigator.clipboard.write([
				new ClipboardItem({ "image/png": blob }),
			]);

			setCopiedQr(true);
			toast.info("QR copied!", { duration: 1000 });
			setTimeout(() => setCopiedQr(false), 2000);
		} catch (err) {
			console.error("Failed to copy QR:", err);
			toast.error("Failed to copy QR code");
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
						onClick={onClose}
					/>

					{/* Sheet */}
					<motion.div
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{ type: "spring", stiffness: 400, damping: 40 }}
						className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-hidden"
					>
						<div className="bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]">
							{/* Header */}
							<div className="flex items-center justify-between px-5 pt-5 pb-3">
								<h2 className="text-lg font-bold">Checkout</h2>
								<motion.button
									type="button"
									whileTap={{ scale: 0.9 }}
									onClick={onClose}
									className="size-9 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
								>
									<X className="size-5" />
								</motion.button>
							</div>

							<Separator />

							{/* Scrollable Content */}
							<div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
								{/* Receipt Preview */}
								<div className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs mb-4">
									<div className="text-center mb-3">
										<h3 className="font-bold text-sm">COCOA COMAA</h3>
										<p className="text-[10px] text-muted-foreground mt-1">
											{new Date().toLocaleDateString()} •{" "}
											{new Date().toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>

									<div className="border-t border-dashed border-gray-200 my-2" />

									{customerName && (
										<p className="text-[10px] text-muted-foreground mb-2">
											Customer: {customerName}
										</p>
									)}

									<div className="space-y-1.5">
										{cart.map((line) => {
											const displayName =
												line.comboName ?? line.baseDessertName;
											return (
												<div
													key={line.cartLineId}
													className="flex justify-between gap-2"
												>
													<div className="flex-1 min-w-0">
														<p className="truncate">{displayName}</p>
														{line.modifiers.length > 0 && !line.comboName && (
															<p className="text-[10px] text-gray-400 truncate">
																+{" "}
																{line.modifiers
																	.map((m) =>
																		m.quantity > 1
																			? `${m.quantity}× ${m.name}`
																			: m.name,
																	)
																	.join(", ")}
															</p>
														)}
													</div>
													<div className="shrink-0 text-right">
														<p>×{line.quantity}</p>
													</div>
													<div className="shrink-0 w-16 text-right">
														₹{(line.unitPrice * line.quantity).toFixed(0)}
													</div>
												</div>
											);
										})}
									</div>

									<div className="border-t border-dashed border-gray-200 my-2" />

									{deliveryCost > 0 && (
										<div className="flex justify-between text-[10px] text-muted-foreground mb-1">
											<span>Delivery</span>
											<span>₹{deliveryCost.toFixed(0)}</span>
										</div>
									)}

									<div className="flex justify-between font-bold text-sm">
										<span>Total</span>
										<span>₹{total.toFixed(0)}</span>
									</div>
								</div>

								{/* UPI Section */}
								<div className="mb-4">
									<div className="flex items-center justify-between mb-2">
										<h3 className="text-sm font-semibold">Payment QR</h3>
										{upiAccounts.length > 1 && (
											<select
												value={selectedUpiId}
												onChange={(e) => setSelectedUpiId(e.target.value)}
												className="text-xs border rounded-lg px-2 py-1 bg-muted"
											>
												{upiAccounts.map((account) => (
													<option
														key={account.id}
														value={account.id.toString()}
													>
														{account.label}
													</option>
												))}
											</select>
										)}
									</div>

									<div className="flex items-center justify-center bg-white rounded-xl p-4 border">
										<QRCodeSVG value={UPI_STRING} size={160} />

										<QRCodeSVG
											ref={qrCodeRef}
											value={UPI_STRING}
											size={405}
											className="hidden"
										/>
									</div>

									<p className="text-[10px] text-center text-muted-foreground mt-2">
										{selectedAccount?.label || "UPI Payment"}
									</p>
								</div>

								{/* Quick Actions */}
								<div className="grid grid-cols-2 gap-3 mb-4">
									<motion.button
										type="button"
										whileTap={{ scale: 0.95 }}
										onClick={copyOrderDetails}
										className={cn(
											"flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all",
											copiedOrder
												? "bg-green-50 border-green-200 text-green-600"
												: "bg-muted/50 hover:bg-muted",
										)}
									>
										{copiedOrder ? (
											<Check className="size-4" />
										) : (
											<Copy className="size-4" />
										)}
										<span className="text-sm font-medium">
											{copiedOrder ? "Copied!" : "Copy Order"}
										</span>
									</motion.button>

									<motion.button
										type="button"
										whileTap={{ scale: 0.95 }}
										onClick={copyQrCode}
										className={cn(
											"flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all",
											copiedQr
												? "bg-green-50 border-green-200 text-green-600"
												: "bg-muted/50 hover:bg-muted",
										)}
									>
										{copiedQr ? (
											<Check className="size-4" />
										) : (
											<ReceiptIndianRupee className="size-4" />
										)}
										<span className="text-sm font-medium">
											{copiedQr ? "Copied!" : "Copy QR"}
										</span>
									</motion.button>
								</div>
							</div>

							{/* Footer Actions */}
							<div className="flex-shrink-0 p-4 pt-2 border-t bg-background safe-area-inset-bottom">
								<div className="flex gap-3">
									<Button
										variant="outline"
										onClick={onClose}
										className="flex-1 h-12 rounded-xl"
									>
										Cancel
									</Button>
									<Button
										onClick={handleSaveOrder}
										disabled={isSaving || orderSaved}
										className={cn(
											"flex-[2] h-12 rounded-xl text-base font-semibold transition-all",
											orderSaved && "bg-green-500 hover:bg-green-500",
										)}
									>
										{isSaving ? (
											<Loader2 className="size-5 animate-spin" />
										) : orderSaved ? (
											<>
												<Check className="size-5 mr-2" />
												Saved!
											</>
										) : (
											`Save Order · ₹${total.toFixed(0)}`
										)}
									</Button>
								</div>
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
