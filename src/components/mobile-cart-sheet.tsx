"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Copy, Loader2, ReceiptIndianRupee, ShoppingBag, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { UpiAccount } from "@/db/schema";
import { MAX_DELIVERY_COST } from "@/lib/order-limits";
import type { GetOrderSubmissionId } from "@/lib/pos-cart-behaviour";
import {
	completeAcknowledgedOrder,
	getOrderCopyText,
	getUpiPaymentText,
	saveCartOrder,
} from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUpiStore } from "@/store/upi-store";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface MobileCartSheetProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
	total: number;
	upiAccounts: UpiAccount[];
	customerName: string;
	onOrderSaved: () => void | Promise<void>;
	clearCart: () => void;
	getSubmissionId: GetOrderSubmissionId;
}

export function MobileCartSheet({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	upiAccounts,
	customerName,
	onOrderSaved,
	clearCart,
	getSubmissionId,
}: MobileCartSheetProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const [showOnlineOptions, setShowOnlineOptions] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);

	const { selectedUpiId, setSelectedUpiId } = useUpiStore();

	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

	useEffect(() => {
		const isValid = upiAccounts.some((account) => account.id.toString() === selectedUpiId);
		if (!isValid && upiAccounts.length > 0) {
			setSelectedUpiId(upiAccounts[0].id.toString());
		}
	}, [upiAccounts, selectedUpiId, setSelectedUpiId]);

	const selectedAccount = upiAccounts.find((account) => account.id.toString() === selectedUpiId);
	const upiId = selectedAccount?.upiId || upiAccounts[0]?.upiId || "";
	const upiPaymentText = getUpiPaymentText(total, cart, upiId);

	const handleToggle = useCallback(() => {
		setIsOpen((prev) => {
			if (!prev) setShouldRender(true);
			return !prev;
		});
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
	}, []);

	const handleExitComplete = useCallback(() => {
		setShouldRender(false);
	}, []);

	const handleSaveOrder = async () => {
		if (cart.length === 0 || isSaving) return;

		setIsSaving(true);
		let result: Awaited<ReturnType<typeof saveCartOrder>>;
		try {
			const deliveryCost = form.state.values.deliveryCost || "0";
			const submissionId = getSubmissionId({ cart, customerName, deliveryCost });
			result = await saveCartOrder(createOrderWithLines, {
				cart,
				customerName,
				deliveryCost,
				submissionId,
			});
		} catch (err) {
			console.error("Failed to save order:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save order");
			setIsSaving(false);
			return;
		}
		if (!result.ok) {
			toast.error(result.error);
			setIsSaving(false);
			return;
		}

		toast.success(result.replayed ? "Order already saved" : "Order saved!");
		try {
			const acknowledgement = await completeAcknowledgedOrder({
				acknowledgement: result,
				clearCart,
				closeCart: () => setIsOpen(false),
				refreshInventory: onOrderSaved,
			});
			if (result.refreshWarning) {
				toast.warning("Order saved, but reporting refresh failed");
			}
			if (!result.refreshWarning && acknowledgement.refreshWarning) {
				toast.warning("Order saved, but inventory refresh failed");
			}
		} finally {
			setIsSaving(false);
		}
	};

	const copyOrderDetails = async () => {
		if (cart.length === 0) return;

		const deliveryCost = Number.parseFloat(form.state.values.deliveryCost || "0");
		const orderText = getOrderCopyText(cart, total, deliveryCost);

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

		try {
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

			return canvas.toDataURL("image/png");
		} finally {
			URL.revokeObjectURL(url);
		}
	};

	const copyQrCode = async () => {
		if (!qrCodeRef.current) return;

		try {
			const dataUrl = await getQrCodeDataUrl();
			const response = await fetch(dataUrl);
			const blob = await response.blob();

			await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

			setCopiedQr(true);
			toast.info("QR copied!", { duration: 1000 });
			setTimeout(() => setCopiedQr(false), 2000);
		} catch (err) {
			console.error("Failed to copy QR:", err);
			toast.error("Failed to copy QR code");
		}
	};

	useEffect(() => {
		if (cart.length === 0 && isOpen) {
			setIsOpen(false);
		}
	}, [cart.length, isOpen]);

	// Don't render if cart is empty and not animating out
	if (cart.length === 0 && !shouldRender) {
		return null;
	}

	return (
		<>
			<QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />

			<AnimatePresence onExitComplete={handleExitComplete}>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 bg-black/30 z-40 md:hidden"
						onClick={handleClose}
					/>
				)}
			</AnimatePresence>

			{shouldRender && !isOpen && <div className="fixed inset-0 z-40 md:hidden" />}

			<AnimatePresence>
				{!isOpen && (
					<motion.div
						initial={{ y: 100, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 100, opacity: 0 }}
						transition={{ type: "spring", stiffness: 400, damping: 35 }}
						className="fixed bottom-0 inset-x-0 z-50 md:hidden p-4 pb-6"
					>
						<button
							type="button"
							onClick={handleToggle}
							className="w-full bg-background rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] border p-4 flex items-center justify-between active:scale-[0.98] transition-transform"
						>
							<div className="flex items-center gap-3">
								<div className="relative">
									<ShoppingBag className="size-6 text-primary" />
									<span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full size-5 flex items-center justify-center">
										{itemCount > 99 ? "99+" : itemCount}
									</span>
								</div>
								<div className="text-left">
									<p className="text-sm font-medium">
										{itemCount} {itemCount === 1 ? "item" : "items"}
									</p>
									<p className="text-xs text-muted-foreground">Tap to view cart</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<p className="text-lg font-bold">₹{total.toFixed(0)}</p>
								<ChevronUp className="size-5 text-muted-foreground" />
							</div>
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{ type: "spring", stiffness: 400, damping: 35 }}
						className="fixed inset-x-0 bottom-0 z-50 md:hidden"
						style={{ maxHeight: "85vh" }}
					>
						<div className="bg-background rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.15)] flex flex-col max-h-[85vh]">
							<button type="button" onClick={handleToggle} className="shrink-0 w-full pt-3 pb-2">
								<div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
							</button>

							<div className="shrink-0 px-4 pb-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="relative">
											<ShoppingBag className="size-6 text-primary" />
											<span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full size-5 flex items-center justify-center">
												{itemCount > 99 ? "99+" : itemCount}
											</span>
										</div>
										<div>
											<p className="text-sm font-medium">
												{itemCount} {itemCount === 1 ? "item" : "items"}
											</p>
											<p className="text-xs text-muted-foreground">Tap handle to close</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<p className="text-lg font-bold">₹{total.toFixed(0)}</p>
										<ChevronUp
											className={cn("size-5 text-muted-foreground transition-transform", isOpen && "rotate-180")}
										/>
									</div>
								</div>
							</div>

							<div className="h-px bg-border mx-4 shrink-0" />
							<div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 min-h-0">
								<AnimatePresence>
									{showForm && (
										<motion.div
											initial={{ height: 0, opacity: 0 }}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: 0, opacity: 0 }}
											className="overflow-hidden"
										>
											<div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b">
												<form.Field name="name">
													{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
													{(field: any) => (
														<div className="space-y-1.5">
															<Label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
																Customer
															</Label>
															<Input
																id={field.name}
																placeholder="Guest"
																value={field.state.value}
																onChange={(e) => field.handleChange(e.target.value)}
																onBlur={field.handleBlur}
																className="h-10"
															/>
														</div>
													)}
												</form.Field>

												<form.Field name="deliveryCost">
													{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
													{(field: any) => (
														<div className="space-y-1.5">
															<Label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
																Delivery (₹)
															</Label>
															<Input
																id={field.name}
																placeholder="0"
																type="number"
																step="0.01"
																min="0"
																max={MAX_DELIVERY_COST}
																value={field.state.value}
																onChange={(e) => field.handleChange(e.target.value)}
																onBlur={field.handleBlur}
																className="h-10"
															/>
														</div>
													)}
												</form.Field>
											</div>
										</motion.div>
									)}
								</AnimatePresence>

								<button
									type="button"
									onClick={() => setShowForm((current) => !current)}
									className="w-full text-xs text-primary font-medium mb-4 flex items-center justify-center gap-1"
								>
									{showForm ? (
										<>
											<X className="size-3" />
											Hide details
										</>
									) : (
										"+ Add customer & delivery"
									)}
								</button>

								<div className="space-y-3">
									<AnimatePresence mode="popLayout">
										{cart.map((line) => (
											<CartLinePresenter
												variant="mobile"
												key={line.cartLineId}
												line={line}
												updateQuantity={updateQuantity}
												removeFromCart={removeFromCart}
											/>
										))}
									</AnimatePresence>
								</div>

								<div className="mt-4 pt-4 border-t">
									<button
										type="button"
										onClick={() => setShowOnlineOptions((current) => !current)}
										className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground"
									>
										<span>Online Order Options</span>
										<ChevronDown className={cn("size-4 transition-transform", showOnlineOptions && "rotate-180")} />
									</button>

									<AnimatePresence>
										{showOnlineOptions && (
											<motion.div
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: "auto", opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												className="overflow-hidden"
											>
												<div className="pt-3 space-y-3">
													{upiAccounts.length > 1 && (
														<div className="flex items-center justify-between">
															<span className="text-xs text-muted-foreground">UPI Account</span>
															<select
																value={selectedUpiId}
																onChange={(e) => setSelectedUpiId(e.target.value)}
																className="text-xs border rounded-lg px-2 py-1 bg-muted"
															>
																{upiAccounts.map((account) => (
																	<option key={account.id} value={account.id.toString()}>
																		{account.label}
																	</option>
																))}
															</select>
														</div>
													)}

													<div className="grid grid-cols-2 gap-3">
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
															{copiedOrder ? <Check className="size-4" /> : <Copy className="size-4" />}
															<span className="text-sm font-medium">{copiedOrder ? "Copied!" : "Copy Order"}</span>
														</motion.button>

														<motion.button
															type="button"
															whileTap={{ scale: 0.95 }}
															onClick={copyQrCode}
															className={cn(
																"flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all",
																copiedQr ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
															)}
														>
															{copiedQr ? <Check className="size-4" /> : <ReceiptIndianRupee className="size-4" />}
															<span className="text-sm font-medium">{copiedQr ? "Copied!" : "Copy QR"}</span>
														</motion.button>
													</div>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</div>

							<div className="shrink-0 p-4 border-t bg-background">
								<Button
									onClick={handleSaveOrder}
									disabled={isSaving}
									className="w-full h-12 text-base font-semibold rounded-xl"
								>
									{isSaving ? <Loader2 className="size-5 animate-spin" /> : `Save Order · ₹${total.toFixed(0)}`}
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
