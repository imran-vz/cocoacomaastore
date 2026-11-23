"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CUSTOMER_NAME_LENGTH, MAX_DELIVERY_COST, WALK_IN_CUSTOMER } from "@/features/orders/contract";
import { type CartLine, lineTotalCents } from "@/features/pos/cart";
import { CartCopyActions } from "@/features/pos/cart-copy-actions";
import type { CartDensity } from "@/features/pos/layout";
import type { PosCart } from "@/features/pos/use-pos-cart";
import { useRepeatPress } from "@/features/pos/use-repeat-press";
import type { CheckoutUpiAccount } from "@/features/upi/shapes";
import { formatINR } from "@/lib/format";
import { rupees } from "@/lib/money";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function CartFields({ cart, density }: { cart: PosCart; density: CartDensity }) {
	const fieldClass = density === "touch" ? "space-y-1.5" : "space-y-1";
	return (
		<>
			<div className={fieldClass}>
				<Label htmlFor="pos-customer-name" className="text-meta text-muted-foreground">
					Customer
				</Label>
				<Input
					id="pos-customer-name"
					placeholder={WALK_IN_CUSTOMER}
					autoComplete="off"
					maxLength={MAX_CUSTOMER_NAME_LENGTH}
					value={cart.customerName}
					onChange={(event) => cart.setCustomerName(event.target.value)}
				/>
			</div>
			<div className={fieldClass}>
				<Label htmlFor="pos-delivery-cost" className="text-meta text-muted-foreground">
					Delivery fee
				</Label>
				<Input
					id="pos-delivery-cost"
					placeholder="0"
					type="number"
					inputMode="decimal"
					step="0.01"
					min="0"
					max={MAX_DELIVERY_COST}
					value={cart.deliveryCost}
					onChange={(event) => cart.setDeliveryCost(event.target.value)}
				/>
			</div>
		</>
	);
}

function CartLineRow({ line, cart, density }: { line: CartLine; cart: PosCart; density: CartDensity }) {
	const canIncrease = cart.canAddOne(line);
	const decrease = useRepeatPress(() => cart.stepLine(line.cartLineId, -1));
	const increase = useRepeatPress(() => cart.stepLine(line.cartLineId, 1), !canIncrease);
	const compact = density === "compact";
	const stepClass = cn(
		"flex items-center justify-center text-foreground transition-colors focus-ring focus-visible:z-10",
		"hover:bg-accent active:bg-accent disabled:pointer-events-none disabled:text-muted-foreground/60",
		compact ? "size-11 md:size-9" : "size-11",
	);
	const iconClass = compact ? "size-5 md:size-4" : "size-5";

	return (
		<motion.li
			layout
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, x: 20 }}
			transition={springSnappy}
			className={cn("bg-card", compact ? "px-3 py-2.5" : "px-4 py-3")}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p className="line-clamp-2 text-row capitalize">{line.name}</p>
					{line.quantity > 1 ? (
						<p className="mt-0.5 truncate text-meta text-muted-foreground">{formatINR(line.unitPrice)} each</p>
					) : null}
				</div>
				<p className="shrink-0 text-row tabular-nums">{formatINR(rupees(lineTotalCents(line)))}</p>
			</div>

			<div className="mt-2 flex items-center justify-between gap-2">
				<fieldset
					aria-label={`Quantity of ${line.name}`}
					className="m-0 flex min-w-0 items-center overflow-hidden rounded-lg border bg-card p-0"
				>
					<motion.button
						whileTap={{ scale: 0.94 }}
						type="button"
						aria-label={`Decrease ${line.name}`}
						className={stepClass}
						{...decrease}
					>
						<Minus className={iconClass} />
					</motion.button>
					<span
						className={cn(
							"min-w-9 border-x px-1 text-center font-semibold tabular-nums",
							compact ? "text-base leading-11 md:text-sm md:leading-9" : "text-base leading-11",
						)}
					>
						{line.quantity}
					</span>
					<motion.button
						whileTap={{ scale: 0.94 }}
						type="button"
						disabled={!canIncrease}
						aria-label={`Increase ${line.name}`}
						className={stepClass}
						{...increase}
					>
						<Plus className={iconClass} />
					</motion.button>
				</fieldset>
				<Button
					variant="ghost"
					size={compact ? "icon" : "icon-touch"}
					aria-label={`Remove ${line.name}`}
					onClick={() => cart.removeLine(line.cartLineId)}
					className="-mr-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 />
				</Button>
			</div>
		</motion.li>
	);
}

export function CartLineList({
	cart,
	density,
	className,
}: {
	cart: PosCart;
	density: CartDensity;
	className?: string;
}) {
	return (
		<ul aria-label="Cart items" className={cn("divide-y", className)}>
			<AnimatePresence mode="popLayout" initial={false}>
				{cart.lines.map((line) => (
					<CartLineRow key={line.cartLineId} line={line} cart={cart} density={density} />
				))}
			</AnimatePresence>
		</ul>
	);
}

/** Order type and copy actions once the cart has lines, then Save. */
export function CartFooter({
	cart,
	upiAccounts,
	density,
	onSave,
	className,
}: {
	cart: PosCart;
	upiAccounts: readonly CheckoutUpiAccount[];
	density: CartDensity;
	onSave: () => void;
	className?: string;
}) {
	const { SaveButton } = cart;
	return (
		<div className={cn("shrink-0 space-y-3 border-t", className)}>
			{cart.lines.length > 0 && <CartCopyActions cart={cart} upiAccounts={upiAccounts} density={density} />}
			<SaveButton
				onClick={onSave}
				disabled={cart.lines.length === 0}
				size="lg"
				className={cn("w-full rounded-xl", density === "touch" && "text-base")}
			/>
		</div>
	);
}
