"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import { AnimatePresence, motion } from "framer-motion";
import {
	Check,
	ChevronDown,
	Copy,
	Loader2,
	Minus,
	Plus,
	ReceiptIndianRupee,
	ShoppingBag,
	Trash2,
	X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createOrderWithLines } from "@/app/manager/orders/actions";
import type { UpiAccount } from "@/db/schema";
import { useLongPress } from "@/hooks/use-long-press";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUpiStore } from "@/store/upi-store";
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

function SidebarCartItem({
	line,
	updateQuantity,
	removeFromCart,
}: {
	line: CartLine;
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
}) {
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const quantityRef = useRef(line.quantity);

	useEffect(() => {
		quantityRef.current = line.quantity;
	}, [line.quantity]);

	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, []);

	const createQuantityHandler = (delta: number) => ({
		threshold: 300,
		onCancel: () => {
			const newQty = quantityRef.current + delta;
			quantityRef.current = newQty;
			updateQuantity(line.cartLineId, newQty);
		},
		onFinish: () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		},
	});

	const decrementLongPress = useLongPress(() => {
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current - 1;
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
			if (nextQty <= 0 && intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}, 100);
	}, createQuantityHandler(-1));

	const incrementLongPress = useLongPress(() => {
		intervalRef.current = setInterval(() => {
			const nextQty = quantityRef.current + 1;
			quantityRef.current = nextQty;
			updateQuantity(line.cartLineId, nextQty);
		}, 100);
	}, createQuantityHandler(1));

	const displayName = line.comboName ?? line.baseDessertName;
	const hasModifiers = line.modifiers.length > 0 && !line.comboName;

	return (
		<motion.div
			layout
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
			transition={{ type: "spring", stiffness: 500, damping: 40 }}
			className="group relative bg-card rounded-xl p-3 border hover:border-primary/20 transition-colors"
		>
			{/* Delete button - appears on hover */}
			<motion.button
				type="button"
				onClick={() => removeFromCart(line.cartLineId)}
				whileTap={{ scale: 0.9 }}
				className={cn(
					"absolute -top-2 -right-2 size-6 rounded-full",
					"bg-destructive text-white shadow-md",
					"flex items-center justify-center",
					"opacity-0 group-hover:opacity-100 transition-opacity",
					"hover:bg-destructive/90",
				)}
			>
				<X className="size-3.5" />
			</motion.button>

			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm leading-tight capitalize truncate">
						{displayName}
					</h4>
					{hasModifiers && (
						<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
							+{" "}
							{line.modifiers
								.map((m) =>
									m.quantity > 1 ? `${m.quantity}× ${m.name}` : m.name,
								)
								.join(", ")}
						</p>
					)}
				</div>
				<p className="font-bold text-sm text-primary shrink-0">
					₹{(line.unitPrice * line.quantity).toFixed(0)}
				</p>
			</div>

			<div className="flex items-center justify-between">
				<p className="text-[10px] text-muted-foreground font-mono">
					₹{line.unitPrice} × {line.quantity}
				</p>

				<div className="flex items-center bg-muted rounded-lg overflow-hidden">
					<motion.button
						whileTap={{ scale: 0.85 }}
						type="button"
						className="h-7 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
						{...decrementLongPress()}
					>
						<Minus className="size-3" />
					</motion.button>
					<span className="w-7 text-center text-xs font-semibold tabular-nums">
						{line.quantity}
					</span>
					<motion.button
						whileTap={{ scale: 0.85 }}
						type="button"
						className="h-7 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
						{...incrementLongPress()}
					>
						<Plus className="size-3" />
					</motion.button>
				</div>
			</div>
		</motion.div>
	);
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
			toast.success("Order saved!");
			await onOrderSaved();
			clearCart();
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
		<div className="h-full flex flex-col bg-muted/30 rounded-2xl border-2 overflow-hidden">
			{/* Header */}
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

			{/* Form Fields */}
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
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
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
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										field.handleChange(e.target.value)
									}
									onBlur={field.handleBlur}
									className="h-8 text-sm"
								/>
							</div>
						)}
					</form.Field>
				</div>
			</div>

			{/* Cart Items */}
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
								<p className="text-[10px] text-muted-foreground/70 mt-1">
									Tap items to add
								</p>
							</motion.div>
						) : (
							cart.map((line) => (
								<SidebarCartItem
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

			{/* Footer with Total and Actions */}
			<div className="shrink-0 p-3 bg-background border-t space-y-3">
				{/* Total */}
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

				{/* Online Order Section - Collapsed by default */}
				{cart.length > 0 && (
					<CollapsiblePrimitive.Root
						open={isOnlineOrderOpen}
						onOpenChange={setIsOnlineOrderOpen}
					>
						<CollapsiblePrimitive.Trigger className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
							<span className="font-medium">Online Order (Instagram)</span>
							<ChevronDown
								className={cn(
									"size-4 transition-transform duration-200",
									isOnlineOrderOpen && "rotate-180",
								)}
							/>
						</CollapsiblePrimitive.Trigger>
						<CollapsiblePrimitive.Panel className="overflow-hidden h-(--collapsible-panel-height) data-ending-style:h-0 data-starting-style:h-0 transition-all duration-200 ease-out">
							<div className="space-y-2 pt-2">
								{/* UPI Account Selector */}
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

								{/* Copy Buttons */}
								<div className="grid grid-cols-2 gap-2">
									<motion.button
										type="button"
										whileTap={{ scale: 0.95 }}
										onClick={copyOrderDetails}
										className={cn(
											"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all",
											copiedOrder
												? "bg-green-50 border-green-200 text-green-600"
												: "bg-muted/50 hover:bg-muted",
										)}
									>
										{copiedOrder ? (
											<Check className="size-3.5" />
										) : (
											<Copy className="size-3.5" />
										)}
										<span>{copiedOrder ? "Copied!" : "Copy Order"}</span>
									</motion.button>

									<motion.button
										type="button"
										whileTap={{ scale: 0.95 }}
										onClick={copyQrCode}
										className={cn(
											"flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all",
											copiedQr
												? "bg-green-50 border-green-200 text-green-600"
												: "bg-muted/50 hover:bg-muted",
										)}
									>
										{copiedQr ? (
											<Check className="size-3.5" />
										) : (
											<ReceiptIndianRupee className="size-3.5" />
										)}
										<span>{copiedQr ? "Copied!" : "Copy QR"}</span>
									</motion.button>
								</div>

								{/* Hidden QR Code for copying */}
								<QRCodeSVG
									ref={qrCodeRef}
									value={UPI_STRING}
									size={400}
									className="hidden"
								/>
							</div>
						</CollapsiblePrimitive.Panel>
					</CollapsiblePrimitive.Root>
				)}

				{/* Save Order Button */}
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
