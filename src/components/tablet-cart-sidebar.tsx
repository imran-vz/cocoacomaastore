"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, Loader2, ReceiptIndianRupee, ShoppingBag, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { UpiAccount } from "@/db/schema";
import { getOrderCopyText, getUpiPaymentText, saveCartOrder } from "@/lib/pos-cart-behaviour";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUpiStore } from "@/store/upi-store";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";

interface TabletCartSidebarProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
	total: number;
	upiAccounts: UpiAccount[];
	onOrderSaved: () => void | Promise<void>;
	clearCart: () => void;
	customerName: string;
	deliveryCost: number;
}

export function TabletCartSidebar({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	upiAccounts,
	onOrderSaved,
	clearCart,
	customerName,
	deliveryCost,
}: TabletCartSidebarProps) {
	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
	const [isSaving, setIsSaving] = useState(false);
	const [copiedOrder, setCopiedOrder] = useState(false);
	const [copiedQr, setCopiedQr] = useState(false);
	const [isOnlineOrderOpen, setIsOnlineOrderOpen] = useState(false);
	const qrCodeRef = useRef<SVGSVGElement>(null);

	const { selectedUpiId, setSelectedUpiId } = useUpiStore();

	useEffect(() => {
		const isValid = upiAccounts.some((account) => account.id.toString() === selectedUpiId);
		if (!isValid && upiAccounts.length > 0) {
			setSelectedUpiId(upiAccounts[0].id.toString());
		}
	}, [upiAccounts, selectedUpiId, setSelectedUpiId]);

	const selectedAccount = upiAccounts.find((account) => account.id.toString() === selectedUpiId);
	const upiId = selectedAccount?.upiId || upiAccounts[0]?.upiId || "";
	const upiPaymentText = getUpiPaymentText(total, cart, upiId);

	const handleSaveOrder = async () => {
		if (cart.length === 0 || isSaving) return;

		try {
			setIsSaving(true);
			const result = await saveCartOrder(createOrderWithLines, {
				cart,
				customerName,
				deliveryCost,
			});
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			toast.success("Order saved!");
			await onOrderSaved();
			clearCart();
		} catch (err) {
			console.error("Failed to complete order save flow:", err);
			toast.error(err instanceof Error ? err.message : "Failed to save order");
		} finally {
			setIsSaving(false);
		}
	};

	const copyOrderDetails = async () => {
		if (cart.length === 0) return;

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

	return (
		<div className="h-full flex flex-col bg-muted/30 rounded-2xl border-2 overflow-hidden">
			<div className="shrink-0 px-4 py-3 bg-background border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="relative">
							<ShoppingBag className="size-5 text-primary" />
							{itemCount > 0 && (
								<motion.span
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full size-4 flex items-center justify-center"
								>
									{itemCount > 99 ? "99" : itemCount}
								</motion.span>
							)}
						</div>
						<h2 className="font-semibold text-sm">Cart</h2>
					</div>
					{cart.length > 0 && (
						<motion.button
							type="button"
							whileTap={{ scale: 0.95 }}
							onClick={() => {
								for (const line of cart) {
									removeFromCart(line.cartLineId);
								}
							}}
							className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
						>
							<Trash2 className="size-3" />
							Clear
						</motion.button>
					)}
				</div>
			</div>

			<div className="shrink-0 px-4 py-3 bg-background/50 border-b">
				<div className="grid grid-cols-2 gap-2">
					<form.Field name="name">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1">
								<Label
									htmlFor={field.name}
									className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
								>
									Customer
								</Label>
								<Input
									id={field.name}
									placeholder="Guest"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className="h-8 text-sm"
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="deliveryCost">
						{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
						{(field: any) => (
							<div className="space-y-1">
								<Label
									htmlFor={field.name}
									className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
								>
									Delivery ₹
								</Label>
								<Input
									id={field.name}
									placeholder="0"
									type="number"
									step="0.01"
									min="0"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									className="h-8 text-sm"
								/>
							</div>
						)}
					</form.Field>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-3 space-y-2">
					<AnimatePresence mode="popLayout">
						{cart.length === 0 ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="flex flex-col items-center justify-center py-12 text-center"
							>
								<ShoppingBag className="size-10 text-muted-foreground/20 mb-2" />
								<p className="text-sm text-muted-foreground">Cart is empty</p>
								<p className="text-[10px] text-muted-foreground/70 mt-1">Tap items to add</p>
							</motion.div>
						) : (
							cart.map((line) => (
								<CartLinePresenter
									variant="tablet"
									key={line.cartLineId}
									line={line}
									updateQuantity={updateQuantity}
									removeFromCart={removeFromCart}
								/>
							))
						)}
					</AnimatePresence>
				</div>
			</ScrollArea>

			<div className="shrink-0 p-3 bg-background border-t space-y-3">
				<div className="flex items-center justify-between px-1">
					<span className="text-sm text-muted-foreground">Total</span>
					<motion.span
						key={total}
						initial={{ scale: 1.1 }}
						animate={{ scale: 1 }}
						className="text-xl font-bold text-primary"
					>
						₹{total.toFixed(0)}
					</motion.span>
				</div>

				{cart.length > 0 && (
					<CollapsiblePrimitive.Root open={isOnlineOrderOpen} onOpenChange={setIsOnlineOrderOpen}>
						<CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
							<span className="font-medium">Online Order (Instagram)</span>
							<ChevronDown
								className={cn("size-4 transition-transform duration-200", isOnlineOrderOpen && "rotate-180")}
							/>
						</CollapsiblePrimitive.Trigger>
						<CollapsiblePrimitive.Panel className="overflow-hidden h-(--collapsible-panel-height) data-ending-style:h-0 data-starting-style:h-0 transition-all duration-200 ease-out">
							<div className="space-y-2 pt-2">
								{upiAccounts.length > 1 && (
									<div className="px-1">
										<select
											value={selectedUpiId}
											onChange={(e) => setSelectedUpiId(e.target.value)}
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
											"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all",
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
										className={cn(
											"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all",
											copiedQr ? "bg-green-50 border-green-200 text-green-600" : "bg-muted/50 hover:bg-muted",
										)}
									>
										{copiedQr ? <Check className="size-3.5" /> : <ReceiptIndianRupee className="size-3.5" />}
										<span>{copiedQr ? "Copied!" : "Copy QR"}</span>
									</motion.button>
								</div>

								<QRCodeSVG ref={qrCodeRef} value={upiPaymentText} size={400} className="hidden" />
							</div>
						</CollapsiblePrimitive.Panel>
					</CollapsiblePrimitive.Root>
				)}

				<Button
					onClick={handleSaveOrder}
					disabled={cart.length === 0 || isSaving}
					className="w-full h-11 text-sm font-semibold rounded-xl"
				>
					{isSaving ? (
						<Loader2 className="size-4 animate-spin" />
					) : cart.length === 0 ? (
						"Add items to save"
					) : (
						`Save Order · ₹${total.toFixed(0)}`
					)}
				</Button>
			</div>
		</div>
	);
}
