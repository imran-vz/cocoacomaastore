"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, Loader2, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { UpiAccount } from "@/db/schema";
import { MAX_DELIVERY_COST } from "@/lib/order-limits";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CartCopyActions } from "./cart-copy-actions";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { SaveCartOrder } from "./use-save-cart-order";

interface MobileCartSheetProps {
	cart: CartLine[];
	updateQuantity: (cartLineId: string, quantity: number) => void;
	removeFromCart: (cartLineId: string) => void;
	// biome-ignore lint/suspicious/noExplicitAny: TanStack form has complex generics
	form: any;
	total: number;
	upiAccounts: UpiAccount[];
	customerName: string;
	deliveryCost: string;
	onSaveOrder: SaveCartOrder;
	isSaving: boolean;
}

export function MobileCartSheet({
	cart,
	updateQuantity,
	removeFromCart,
	form,
	total,
	upiAccounts,
	customerName,
	deliveryCost,
	onSaveOrder,
	isSaving,
}: MobileCartSheetProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);
	const [showForm, setShowForm] = useState(false);

	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

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
		await onSaveOrder({
			customerName,
			deliveryCost: form.state.values.deliveryCost || "0",
			closeCart: () => setIsOpen(false),
		});
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

								<div className="mt-4 border-t pt-4">
									<CartCopyActions cart={cart} total={total} deliveryCost={deliveryCost} upiAccounts={upiAccounts} />
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
