"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLongPress } from "@/hooks/use-long-press";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
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
	onCheckout: () => void;
}

function CartLineItem({
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
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
			transition={{ type: "spring", stiffness: 500, damping: 40 }}
			className="bg-card rounded-xl p-3 shadow-sm border"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-sm leading-tight capitalize truncate">
						{displayName}
					</h4>
					{hasModifiers && (
						<p className="text-xs text-muted-foreground mt-0.5 truncate">
							+{" "}
							{line.modifiers
								.map((m) =>
									m.quantity > 1 ? `${m.quantity}× ${m.name}` : m.name,
								)
								.join(", ")}
						</p>
					)}
					<p className="text-xs text-muted-foreground mt-1 font-mono">
						₹{line.unitPrice} × {line.quantity}
					</p>
				</div>
				<div className="text-right shrink-0">
					<p className="font-bold text-sm text-primary">
						₹{(line.unitPrice * line.quantity).toFixed(0)}
					</p>
				</div>
			</div>

			<div className="flex items-center justify-between mt-3 gap-2">
				<div className="flex items-center bg-muted rounded-lg overflow-hidden">
					<motion.button
						whileTap={{ scale: 0.9 }}
						type="button"
						className="h-9 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
						{...decrementLongPress()}
					>
						<Minus className="size-4" />
					</motion.button>
					<span className="w-10 text-center text-sm font-semibold tabular-nums">
						{line.quantity}
					</span>
					<motion.button
						whileTap={{ scale: 0.9 }}
						type="button"
						className="h-9 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
						{...incrementLongPress()}
					>
						<Plus className="size-4" />
					</motion.button>
				</div>
				<motion.button
					whileTap={{ scale: 0.9 }}
					type="button"
					onClick={() => removeFromCart(line.cartLineId)}
					className="h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
				>
					<Trash2 className="size-4" />
				</motion.button>
			</div>
		</motion.div>
	);
}

export function MobileCartSheet({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	onCheckout,
}: MobileCartSheetProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

	const handleToggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
	}, []);

	// Close sheet when cart becomes empty
	useEffect(() => {
		if (cart.length === 0 && isOpen) {
			setIsOpen(false);
		}
	}, [cart.length, isOpen]);

	// Don't render if cart is empty
	if (cart.length === 0) {
		return null;
	}

	return (
		<>
			{/* Backdrop */}
			<AnimatePresence>
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

			{/* Collapsed Bar - Fixed at bottom */}
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
									<p className="text-xs text-muted-foreground">
										Tap to view cart
									</p>
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

			{/* Full Sheet - Slides up from bottom */}
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
							{/* Handle Bar */}
							<button
								type="button"
								onClick={handleToggle}
								className="shrink-0 w-full pt-3 pb-2"
							>
								<div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
							</button>

							{/* Header */}
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
											<p className="text-xs text-muted-foreground">
												Tap handle to close
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<p className="text-lg font-bold">₹{total.toFixed(0)}</p>
										<ChevronUp
											className={cn(
												"size-5 text-muted-foreground transition-transform",
												isOpen && "rotate-180",
											)}
										/>
									</div>
								</div>
							</div>

							{/* Divider */}
							<div className="h-px bg-border mx-4 shrink-0" />

							{/* Cart Content - Scrollable */}
							<div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 min-h-0">
								{/* Form Fields */}
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
															<Label
																htmlFor={field.name}
																className="text-xs font-medium text-muted-foreground"
															>
																Customer
															</Label>
															<Input
																id={field.name}
																placeholder="Guest"
																value={field.state.value}
																onChange={(
																	e: React.ChangeEvent<HTMLInputElement>,
																) => field.handleChange(e.target.value)}
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
															<Label
																htmlFor={field.name}
																className="text-xs font-medium text-muted-foreground"
															>
																Delivery (₹)
															</Label>
															<Input
																id={field.name}
																placeholder="0"
																type="number"
																step="0.01"
																min="0"
																value={field.state.value}
																onChange={(
																	e: React.ChangeEvent<HTMLInputElement>,
																) => field.handleChange(e.target.value)}
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

								{/* Toggle Form Button */}
								<button
									type="button"
									onClick={() => setShowForm(!showForm)}
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

								{/* Cart Items */}
								<div className="space-y-3">
									<AnimatePresence mode="popLayout">
										{cart.map((line) => (
											<CartLineItem
												key={line.cartLineId}
												line={line}
												updateQuantity={updateQuantity}
												removeFromCart={removeFromCart}
											/>
										))}
									</AnimatePresence>
								</div>
							</div>

							{/* Checkout Button - Fixed at bottom */}
							<div className="shrink-0 p-4 border-t bg-background">
								<Button
									onClick={onCheckout}
									className="w-full h-12 text-base font-semibold rounded-xl"
								>
									Checkout · ₹{total.toFixed(0)}
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
