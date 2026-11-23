"use client";

import { Check, CircleAlert, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FEEDBACK_MS } from "@/components/ui/feedback";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { Spinner } from "@/components/ui/spinner";
import { restockDessert } from "@/features/catalog/actions";
import type { Dessert } from "@/features/catalog/queries";
import { comboPriceOf } from "@/features/catalog/rules";
import type { SellableCombo } from "@/features/pos/cart";
import { useRunAction } from "@/lib/action-result";
import { formatBadgeCount, formatCount, formatINR } from "@/lib/format";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

const LOW_STOCK_THRESHOLD = 5;

const StockSpinnerIcon = ({ className }: { className?: string }) => <Spinner className={cn("size-3.5", className)} />;
const StockCheckIcon = ({ className }: { className?: string }) => <Check className={cn("size-3.5", className)} />;
const StockAlertIcon = ({ className }: { className?: string }) => <CircleAlert className={cn("size-3.5", className)} />;

/** True for a moment each time `rejectedAt` takes a new value: the cart refused an add from this tile. */
function useRejectFlash(rejectedAt: number | undefined) {
	const [flashing, setFlashing] = useState(false);
	const seen = useRef(rejectedAt);
	useEffect(() => {
		if (rejectedAt === undefined || rejectedAt === seen.current) return;
		seen.current = rejectedAt;
		setFlashing(true);
		const timer = setTimeout(() => setFlashing(false), FEEDBACK_MS.reject);
		return () => {
			clearTimeout(timer);
			setFlashing(false);
		};
	}, [rejectedAt]);
	return flashing;
}

/** A quiet "+" at rest, the in-cart count once the item is in the cart, and a short "×" when an add is refused. */
function TileSlot({ quantity, rejected }: { quantity: number; rejected: boolean }) {
	if (rejected) {
		return (
			<span className="flex size-5.5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
				<X className="size-3.5" strokeWidth={2.5} />
			</span>
		);
	}
	if (quantity > 0) {
		return (
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					key={quantity}
					initial={{ scale: 1.35 }}
					animate={{ scale: 1 }}
					transition={tweenFast}
					className="flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground tabular-nums"
				>
					{formatBadgeCount(quantity)}
				</motion.span>
			</AnimatePresence>
		);
	}
	return (
		<span className="flex size-5.5 items-center justify-center text-muted-foreground/70 transition-colors group-hover/tile:text-foreground">
			<Plus className="size-4.5" strokeWidth={2} />
		</span>
	);
}

function tileShellClass({ inCart, interactive }: { inCart: boolean; interactive: boolean }) {
	return cn(
		"group/tile relative flex h-full min-h-27 w-full flex-col rounded-xl border p-3 text-left shadow-xs transition-[background-color,border-color,box-shadow] duration-fast focus-ring",
		inCart
			? "border-primary/40 bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))] ring-[0.5px] ring-primary/40"
			: "bg-card",
		interactive && !inCart && "hover:bg-accent active:bg-accent",
		interactive && inCart && "hover:bg-[color-mix(in_oklab,var(--primary)_8%,var(--card))]",
	);
}

function TileBody({
	name,
	meta,
	price,
	trailing,
	priceMuted = false,
}: {
	name: string;
	meta?: React.ReactNode;
	price: number;
	trailing?: React.ReactNode;
	priceMuted?: boolean;
}) {
	return (
		<>
			<span className="line-clamp-3 text-row text-pretty text-foreground">{name}</span>
			{meta ? <span className="mt-1 flex min-h-5 items-center text-meta text-muted-foreground">{meta}</span> : null}
			<span className="mt-auto flex items-end justify-between gap-2 pt-2">
				<span className={cn("text-row tabular-nums", priceMuted ? "text-muted-foreground" : "text-foreground")}>
					{formatINR(price)}
				</span>
				{trailing}
			</span>
		</>
	);
}

function TileFrame({ children }: { children: React.ReactNode }) {
	return <div className="h-full select-none">{children}</div>;
}

function AddTile({
	name,
	label,
	meta,
	price,
	inCart,
	rejectedAt,
	onAdd,
}: {
	name: string;
	label: string;
	meta: React.ReactNode;
	price: number;
	inCart: number;
	rejectedAt: number | undefined;
	onAdd: () => void;
}) {
	const rejected = useRejectFlash(rejectedAt);
	return (
		<TileFrame>
			<motion.button
				type="button"
				onClick={onAdd}
				whileTap={{ scale: 0.97 }}
				aria-label={`${label} ${formatINR(price)}${inCart > 0 ? `, ${inCart} in cart` : ""}`}
				className={tileShellClass({ inCart: inCart > 0, interactive: true })}
			>
				<TileBody name={name} meta={meta} price={price} trailing={<TileSlot quantity={inCart} rejected={rejected} />} />
			</motion.button>
		</TileFrame>
	);
}

/** A dessert on sale. `left` is how many more the cart can take today: infinite when stock is unlimited. */
export function DessertTile({
	dessert,
	left,
	inCart,
	rejectedAt,
	onAdd,
}: {
	dessert: Pick<Dessert, "name" | "price">;
	left: number;
	inCart: number;
	rejectedAt: number | undefined;
	onAdd: () => void;
}) {
	const meta =
		left === Number.POSITIVE_INFINITY ? null : left < LOW_STOCK_THRESHOLD ? (
			<Badge variant="warning">{formatCount(Math.max(left, 0), "left")}</Badge>
		) : (
			<span className="tabular-nums">{formatCount(left, "left")}</span>
		);
	return (
		<AddTile
			name={dessert.name}
			label={dessert.name}
			meta={meta}
			price={dessert.price}
			inCart={inCart}
			rejectedAt={rejectedAt}
			onAdd={onAdd}
		/>
	);
}

export function ComboTile({
	combo,
	inCart,
	rejectedAt,
	onAdd,
}: {
	combo: SellableCombo;
	inCart: number;
	rejectedAt: number | undefined;
	onAdd: () => void;
}) {
	return (
		<AddTile
			name={combo.name}
			label={`${combo.name} combo`}
			meta="Combo"
			price={comboPriceOf(combo)}
			inCart={inCart}
			rejectedAt={rejectedAt}
			onAdd={onAdd}
		/>
	);
}

/**
 * A dessert that cannot be sold now. One marked out of stock offers Restock, which only ever puts it
 * back on sale: marking items unavailable from the grid was too easy to hit by accident. The saved
 * restock re-renders the Sell screen, which then shows the dessert as the server has it.
 */
export function UnavailableDessertTile({
	dessert,
}: {
	dessert: Pick<Dessert, "id" | "name" | "price" | "isOutOfStock">;
}) {
	const runAction = useRunAction();
	const [restockButton, RestockButton] = useReactiveButton({
		label: "Restock",
		icon: null,
		loading: { label: "", icon: StockSpinnerIcon },
		success: { icon: StockCheckIcon, duration: FEEDBACK_MS.inline },
		error: { label: "Failed", icon: StockAlertIcon, duration: FEEDBACK_MS.inline },
	});

	const handleRestock = async () => {
		if (restockButton.status !== "idle") return;
		const token = restockButton.setLoading();
		const result = await runAction(restockDessert(dessert.id), { refetch: "background" });
		if (result.ok) restockButton.setSuccess(`${dessert.name} marked available`, { token });
		else restockButton.setError(undefined, { token });
	};

	return (
		<TileFrame>
			<div className={tileShellClass({ inCart: false, interactive: false })}>
				<TileBody
					name={dessert.name}
					meta={<Badge variant="destructive">Out of stock</Badge>}
					price={dessert.price}
					priceMuted
					trailing={
						dessert.isOutOfStock ? (
							<RestockButton
								onClick={handleRestock}
								aria-label={`Restock ${dessert.name}`}
								variant="outline"
								size="sm"
								className="-my-1 -mr-1"
							/>
						) : null
					}
				/>
			</div>
		</TileFrame>
	);
}
