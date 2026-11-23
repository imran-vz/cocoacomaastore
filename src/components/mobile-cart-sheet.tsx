"use client";

import { ChevronRight, ChevronUp, UserRound, X } from "lucide-react";
import { AnimatePresence, motion, type PanInfo, useDragControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { UpiAccount } from "@/db/schema";
import { formatCount, formatINR } from "@/lib/format";
import { springSheet, tweenEnter } from "@/lib/motion";
import { MAX_DELIVERY_COST } from "@/lib/order-limits";
import type { CartLine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CartCopyActions } from "./cart-copy-actions";
import { CartLinePresenter } from "./cart-line-presenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { ReactiveButtonComponent, ReactiveButtonControls } from "./ui/reactive-button";
import { useModalFocus } from "./ui/use-modal-focus";
import type { SaveCartOrder } from "./use-save-cart-order";

// Swipe past either threshold (distance in px, or flick velocity in px/s)
// toggles the sheet between collapsed and expanded.
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

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
	saveControls: ReactiveButtonControls;
	SaveButton: ReactiveButtonComponent;
	/** Viewport-relative box of the POS pane; the bar and sheet align to it. */
	frame?: { left: number; width: number };
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
	saveControls,
	SaveButton,
	frame,
}: MobileCartSheetProps) {
	const [isOpen, setIsOpen] = useState(false);
	// The expanded sheet renders into <body>: the admin content area is an isolated stacking
	// context (page texture), which would otherwise trap the sheet under the bottom tabs.
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	useEffect(() => setPortalTarget(document.body), []);
	const [shouldRender, setShouldRender] = useState(false);
	const [showForm, setShowForm] = useState(false);
	const openSessionRef = useRef(0);

	const [totalTicked, setTotalTicked] = useState(false);
	const prevTotalRef = useRef(total);
	useEffect(() => {
		if (prevTotalRef.current === total) return;
		prevTotalRef.current = total;
		setTotalTicked(true);
		const timer = setTimeout(() => setTotalTicked(false), 300);
		return () => clearTimeout(timer);
	}, [total]);

	const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
	const deliveryAmount = Number.parseFloat(deliveryCost || "0") || 0;
	const hasDetails = customerName.trim() !== "" || deliveryAmount > 0;

	const handleToggle = useCallback(() => {
		openSessionRef.current += 1;
		setIsOpen((prev) => {
			if (!prev) setShouldRender(true);
			return !prev;
		});
	}, []);

	// Drag-to-collapse: only pointer-downs on the handle/header start the drag,
	// so the scrollable body keeps its native vertical scroll.
	const dragControls = useDragControls();
	const startExpandedDrag = useCallback(
		(event: React.PointerEvent) => {
			dragControls.start(event);
		},
		[dragControls],
	);

	const handleExpandedDragEnd = useCallback((_event: unknown, info: PanInfo) => {
		if (info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY) {
			openSessionRef.current += 1;
			setIsOpen(false);
		}
	}, []);

	const handleCollapsedDragEnd = useCallback((_event: unknown, info: PanInfo) => {
		if (info.offset.y < -SWIPE_DISTANCE || info.velocity.y < -SWIPE_VELOCITY) {
			openSessionRef.current += 1;
			setShouldRender(true);
			setIsOpen(true);
		}
	}, []);

	const handleClose = useCallback(() => {
		openSessionRef.current += 1;
		setIsOpen(false);
	}, []);

	// A real modal (decision 3): the page behind is inert, Tab wraps inside the sheet, focus
	// starts on Close cart and returns to View cart on Escape, close, swipe or scrim tap. If
	// the bar is gone (the last line was removed) it returns to the search field.
	const overlayRef = useRef<HTMLDivElement>(null);
	const viewCartRef = useRef<HTMLButtonElement>(null);
	useModalFocus({
		open: isOpen,
		containerRef: overlayRef,
		returnFocusRef: viewCartRef,
		fallbackFocus: () => document.querySelector<HTMLElement>("[data-pos-search]"),
		onEscape: handleClose,
	});

	const handleExitComplete = useCallback(() => {
		setShouldRender(false);
	}, []);

	const handleSaveOrder = async () => {
		const openSession = openSessionRef.current;
		await onSaveOrder({
			customerName,
			deliveryCost: form.state.values.deliveryCost || "0",
			closeCart: () => {
				if (openSessionRef.current === openSession) setIsOpen(false);
			},
		});
	};

	useEffect(() => {
		if (cart.length === 0 && isOpen && saveControls.status !== "success") {
			setIsOpen(false);
		}
	}, [cart.length, isOpen, saveControls.status]);

	useEffect(() => {
		if (cart.length === 0 && !isOpen) setShouldRender(false);
	}, [cart.length, isOpen]);

	// Keep save feedback state mounted without showing an empty collapsed cart or blocker.
	if (cart.length === 0 && !isOpen) {
		return null;
	}

	const subtitle = [
		customerName.trim() || "Walk-in",
		deliveryAmount > 0 ? `Delivery ${formatINR(deliveryAmount)}` : null,
	]
		.filter(Boolean)
		.join(" · ");
	// In sheet mode the bar and sheet line up with the POS pane (it can sit beside the admin
	// sidebar on tablets); without a measurement they span the viewport.
	const frameStyle = frame ? { left: frame.left, width: frame.width } : undefined;

	return (
		<>
			{/* Scrim + sheet share one container so the scrim stays tappable while the rest of
			    the page is inert. */}
			{portalTarget &&
				createPortal(
					<div ref={overlayRef} className="contents">
						<AnimatePresence onExitComplete={handleExitComplete}>
							{isOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={tweenEnter}
									className="fixed inset-0 z-40 bg-foreground/30"
									onClick={handleClose}
								/>
							)}
						</AnimatePresence>

						<AnimatePresence>
							{isOpen && (
								<motion.div
									role="dialog"
									aria-modal="true"
									aria-labelledby="pos-cart-title"
									initial={{ y: "100%" }}
									animate={{ y: 0 }}
									exit={{ y: "100%" }}
									transition={springSheet}
									drag="y"
									dragControls={dragControls}
									dragListener={false}
									dragConstraints={{ top: 0, bottom: 0 }}
									dragElastic={{ top: 0, bottom: 0.5 }}
									onDragEnd={handleExpandedDragEnd}
									style={frameStyle}
									className="fixed inset-x-0 bottom-0 z-50"
								>
									<div className="flex max-h-[88svh] flex-col rounded-t-2xl bg-card shadow-[0_-8px_32px_rgb(0_0_0/0.18)]">
										{/* Drag handle + header: pointer-downs here start the drag-to-close. */}
										<div className="shrink-0 touch-none" onPointerDown={startExpandedDrag}>
											<div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" />
											<div className="flex items-center gap-3 py-1.5 pr-2 pl-4">
												<div className="min-w-0 flex-1">
													<h2 id="pos-cart-title" className="text-[20px] leading-7 font-bold">
														Cart
														<span className="ml-2 text-[15px] font-normal text-muted-foreground tabular-nums">
															{formatCount(itemCount, "items")}
														</span>
													</h2>
													<p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
												</div>
												<Button
													variant="ghost"
													size="icon-touch"
													aria-label="Close cart"
													onClick={handleClose}
													onPointerDown={(event) => event.stopPropagation()}
													className="rounded-full bg-muted hover:bg-accent"
												>
													<X />
												</Button>
											</div>
										</div>

										<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
											<div className="overflow-hidden rounded-xl border bg-card">
												<button
													type="button"
													aria-expanded={showForm}
													aria-controls="pos-cart-details"
													onClick={() => setShowForm((current) => !current)}
													className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-accent focus-ring"
												>
													<UserRound aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate text-[15px] font-medium">
														{hasDetails ? subtitle : "Add customer & delivery"}
													</span>
													<ChevronRight
														aria-hidden="true"
														className={cn(
															"size-5 shrink-0 text-muted-foreground transition-transform duration-200",
															showForm && "rotate-90",
														)}
													/>
												</button>
												<div
													id="pos-cart-details"
													inert={!showForm}
													className={cn(
														"grid transition-[grid-template-rows,opacity] duration-200 ease-out",
														showForm ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
													)}
												>
													<div className="overflow-hidden">
														<div className="grid grid-cols-2 gap-3 border-t px-4 pt-3 pb-4">
															<form.Field name="name">
																{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
																{(field: any) => (
																	<div className="space-y-1.5">
																		<Label htmlFor={field.name} className="text-[13px] text-muted-foreground">
																			Customer
																		</Label>
																		<Input
																			id={field.name}
																			placeholder="Walk-in"
																			autoComplete="off"
																			value={field.state.value}
																			onChange={(e) => field.handleChange(e.target.value)}
																			onBlur={field.handleBlur}
																		/>
																	</div>
																)}
															</form.Field>

															<form.Field name="deliveryCost">
																{/* biome-ignore lint/suspicious/noExplicitAny: TanStack field type */}
																{(field: any) => (
																	<div className="space-y-1.5">
																		<Label htmlFor={field.name} className="text-[13px] text-muted-foreground">
																			Delivery fee
																		</Label>
																		<Input
																			id={field.name}
																			placeholder="0"
																			type="number"
																			inputMode="decimal"
																			step="0.01"
																			min="0"
																			max={MAX_DELIVERY_COST}
																			value={field.state.value}
																			onChange={(e) => field.handleChange(e.target.value)}
																			onBlur={field.handleBlur}
																		/>
																	</div>
																)}
															</form.Field>
														</div>
													</div>
												</div>
											</div>

											<ul
												aria-label="Cart items"
												className="mt-3 divide-y overflow-hidden rounded-xl border empty:hidden"
											>
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
											</ul>
										</div>

										<div className="shrink-0 space-y-3 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
											{cart.length > 0 && (
												<CartCopyActions
													cart={cart}
													total={total}
													deliveryCost={deliveryCost}
													upiAccounts={upiAccounts}
												/>
											)}

											<SaveButton
												onClick={handleSaveOrder}
												disabled={cart.length === 0}
												size="lg"
												className="w-full rounded-xl text-base"
											/>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>,
					portalTarget,
				)}

			{shouldRender && !isOpen && <div className="fixed inset-0 z-40" />}

			<AnimatePresence>
				{!isOpen && (
					<motion.div
						initial={{ y: 100, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 100, opacity: 0 }}
						transition={springSheet}
						drag="y"
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={{ top: 0.5, bottom: 0 }}
						onDragEnd={handleCollapsedDragEnd}
						style={frameStyle}
						className="fixed inset-x-0 bottom-above-nav z-30 px-3 pb-2 md:px-4 md:pb-4"
					>
						<button
							ref={viewCartRef}
							type="button"
							onClick={handleToggle}
							aria-label={`View cart, ${formatCount(itemCount, "items")}, ${formatINR(total)}`}
							className="flex h-13 w-full items-center gap-3 rounded-xl bg-primary pr-3 pl-2 text-primary-foreground shadow-lg shadow-primary/20 transition-transform focus-ring active:scale-[0.98]"
						>
							<span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary-foreground/15 px-2 text-[15px] font-bold tabular-nums">
								{itemCount > 99 ? "99+" : itemCount}
							</span>
							<span className="flex-1 text-left text-[15px] font-semibold">View cart</span>
							<span
								className={cn(
									"text-[17px] font-bold tabular-nums transition-transform duration-300 ease-out motion-reduce:transition-none",
									totalTicked && "scale-110",
								)}
							>
								{formatINR(total)}
							</span>
							<ChevronUp aria-hidden="true" className="size-5 opacity-70" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
