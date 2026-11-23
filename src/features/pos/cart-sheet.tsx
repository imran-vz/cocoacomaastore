"use client";

import { ChevronRight, ChevronUp, UserRound, X } from "lucide-react";
import { AnimatePresence, motion, type PanInfo, useDragControls } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SheetGrabber, scrimClassName, sheetSurfaceClassName } from "@/components/ui/overlay";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import { WALK_IN_CUSTOMER } from "@/features/orders/contract";
import { CartFields, CartFooter, CartLineList } from "@/features/pos/cart-parts";
import type { PosCart } from "@/features/pos/use-pos-cart";
import type { CheckoutUpiAccount } from "@/features/upi/shapes";
import { formatBadgeCount, formatCount, formatINR, UNIT } from "@/lib/format";
import { rupees } from "@/lib/money";
import { MOTION_MS, springSheet, tweenEnter } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** A swipe toggles the sheet once it passes either threshold: distance in px, or flick velocity in px/s. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 400;

/** The cart as a bar at the bottom of the POS pane that opens into a modal sheet. */
export function CartSheet({
	cart,
	upiAccounts,
	frame,
}: {
	cart: PosCart;
	upiAccounts: readonly CheckoutUpiAccount[];
	/** Viewport-relative box of the POS pane; the bar and sheet line up with it. */
	frame: { left: number; width: number };
}) {
	const [isOpen, setIsOpen] = useState(false);
	// The expanded sheet renders into <body>: the admin content area is an isolated stacking
	// context (page texture), which would otherwise trap the sheet under the bottom tabs.
	const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
	useEffect(() => setPortalTarget(document.body), []);
	const [shouldRender, setShouldRender] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	// Each open or close starts a new session, so a save's close only applies to the session it was made in.
	const openSessionRef = useRef(0);
	const hasLines = cart.lines.length > 0;

	const [totalTicked, setTotalTicked] = useState(false);
	const prevTotalRef = useRef(cart.totalCents);
	useEffect(() => {
		if (prevTotalRef.current === cart.totalCents) return;
		prevTotalRef.current = cart.totalCents;
		setTotalTicked(true);
		// The total stays enlarged for as long as its `duration-sheet` transition takes.
		const timer = setTimeout(() => setTotalTicked(false), MOTION_MS.sheet);
		return () => clearTimeout(timer);
	}, [cart.totalCents]);

	const open = useCallback(() => {
		openSessionRef.current += 1;
		setShouldRender(true);
		setIsOpen(true);
	}, []);

	const close = useCallback(() => {
		openSessionRef.current += 1;
		setIsOpen(false);
	}, []);

	// Removing the last line closes the sheet; a save that empties it closes it after its confirmation.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the cashier changes the cart, not when a save empties it
	useEffect(() => {
		if (!hasLines) setIsOpen(false);
	}, [cart.version]);

	useEffect(() => {
		if (!hasLines && !isOpen) setShouldRender(false);
	}, [hasLines, isOpen]);

	const handleSave = async () => {
		const session = openSessionRef.current;
		if ((await cart.save()) && openSessionRef.current === session) close();
	};

	// Drag-to-collapse starts only from the handle and header, so the body keeps its native scroll.
	const dragControls = useDragControls();
	const handleExpandedDragEnd = useCallback(
		(_event: unknown, info: PanInfo) => {
			if (info.offset.y > SWIPE_DISTANCE || info.velocity.y > SWIPE_VELOCITY) close();
		},
		[close],
	);
	const handleCollapsedDragEnd = useCallback(
		(_event: unknown, info: PanInfo) => {
			if (info.offset.y < -SWIPE_DISTANCE || info.velocity.y < -SWIPE_VELOCITY) open();
		},
		[open],
	);

	// The page behind is inert while the sheet is open. Focus starts on Close cart and returns to View cart,
	// or to the search field when the bar is gone because the last line was removed.
	const overlayRef = useRef<HTMLDivElement>(null);
	const viewCartRef = useRef<HTMLButtonElement>(null);
	useModalFocus({
		open: isOpen,
		containerRef: overlayRef,
		returnFocusRef: viewCartRef,
		fallbackFocus: () => document.querySelector<HTMLElement>("[data-pos-search]"),
		onEscape: close,
	});

	if (!hasLines && !isOpen) return null;

	const hasDetails = cart.customerName.trim() !== "" || cart.deliveryCents > 0;
	const subtitle = [
		cart.customerName.trim() || WALK_IN_CUSTOMER,
		cart.deliveryCents > 0 ? `Delivery ${formatINR(rupees(cart.deliveryCents))}` : null,
	]
		.filter(Boolean)
		.join(" · ");
	const frameStyle = { left: frame.left, width: frame.width };

	return (
		<>
			{portalTarget &&
				createPortal(
					// Scrim and sheet share one container so the scrim stays tappable while the page is inert.
					<div ref={overlayRef} className="contents">
						<AnimatePresence onExitComplete={() => setShouldRender(false)}>
							{isOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={tweenEnter}
									className={cn("fixed inset-0 z-overlay", scrimClassName)}
									onClick={close}
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
									className="fixed inset-x-0 bottom-0 z-overlay"
								>
									<div className={cn("flex max-h-[88svh] flex-col", sheetSurfaceClassName)}>
										<div className="shrink-0 touch-none" onPointerDown={(event) => dragControls.start(event)}>
											<SheetGrabber />
											<div className="flex items-center gap-3 py-1.5 pr-2 pl-4">
												<div className="min-w-0 flex-1">
													<h2 id="pos-cart-title" className="text-[20px] leading-7 font-bold">
														Cart
														<span className="ml-2 text-[15px] font-normal text-muted-foreground tabular-nums">
															{formatCount(cart.itemCount, UNIT.item)}
														</span>
													</h2>
													<p className="truncate text-meta text-muted-foreground">{subtitle}</p>
												</div>
												<Button
													variant="ghost"
													size="icon-touch"
													aria-label="Close cart"
													onClick={close}
													onPointerDown={(event) => event.stopPropagation()}
													className="rounded-full bg-muted hover:bg-accent"
												>
													<X />
												</Button>
											</div>
										</div>

										<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
											<div className="surface-card overflow-hidden">
												<button
													type="button"
													aria-expanded={showDetails}
													aria-controls="pos-cart-details"
													onClick={() => setShowDetails((current) => !current)}
													className="flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-accent focus-ring"
												>
													<UserRound aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
													<span className="min-w-0 flex-1 truncate text-[15px] font-medium">
														{hasDetails ? subtitle : "Add customer & delivery"}
													</span>
													<ChevronRight
														aria-hidden="true"
														className={cn(
															"size-5 shrink-0 text-muted-foreground transition-transform duration-enter",
															showDetails && "rotate-90",
														)}
													/>
												</button>
												<div
													id="pos-cart-details"
													inert={!showDetails}
													className={cn(
														"grid transition-[grid-template-rows,opacity] duration-enter ease-out",
														showDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
													)}
												>
													<div className="overflow-hidden">
														<div className="grid grid-cols-2 gap-3 border-t px-4 pt-3 pb-4">
															<CartFields cart={cart} density="touch" />
														</div>
													</div>
												</div>
											</div>

											<CartLineList
												cart={cart}
												density="touch"
												className="mt-3 overflow-hidden rounded-xl border empty:hidden"
											/>
										</div>

										<CartFooter
											cart={cart}
											upiAccounts={upiAccounts}
											density="touch"
											onSave={handleSave}
											className="bg-card px-4 pt-3 pb-safe-3"
										/>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>,
					portalTarget,
				)}

			{shouldRender && !isOpen && <div className="fixed inset-0 z-overlay" />}

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
						className="fixed inset-x-0 bottom-above-nav z-bar px-3 pb-2 md:px-4 md:pb-4"
					>
						<button
							ref={viewCartRef}
							type="button"
							onClick={open}
							aria-label={`View cart, ${formatCount(cart.itemCount, UNIT.item)}, ${formatINR(rupees(cart.totalCents))}`}
							className="flex h-13 w-full items-center gap-3 rounded-xl bg-primary pr-3 pl-2 text-primary-foreground shadow-lg shadow-primary/20 transition-transform focus-ring active:scale-[0.98]"
						>
							<span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary-foreground/15 px-2 text-[15px] font-bold tabular-nums">
								{formatBadgeCount(cart.itemCount)}
							</span>
							<span className="flex-1 text-left text-row">View cart</span>
							<span
								className={cn(
									"text-[17px] font-bold tabular-nums transition-transform duration-sheet ease-out motion-reduce:transition-none",
									totalTicked && "scale-110",
								)}
							>
								{formatINR(rupees(cart.totalCents))}
							</span>
							<ChevronUp aria-hidden="true" className="size-5 opacity-70" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}
