"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ListRow } from "@/components/ui/list-row";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { SaveBar } from "@/components/ui/save-bar";
import { MAX_STOCK_QUANTITY } from "@/features/inventory/schemas";
import { type CountableDessert, isCounted } from "@/features/inventory/shapes";
import type { StockCount } from "@/features/inventory/use-stock-count";
import { formatCount, UNIT } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The bottom save bar for stock edits: shown while counts are changed and while a save is giving feedback. */
export function StockSaveBar({ stock }: { stock: StockCount }) {
	const [controls, SaveButton] = useReactiveButton({ label: "Save stock", loading: { label: "Saving…" } });
	const { reset } = controls;

	// Typing a new count ends the "Saved" flash.
	useEffect(() => {
		if (stock.hasChanges) reset({ ifStatus: "success" });
	}, [stock.hasChanges, reset]);

	const save = async () => {
		const token = controls.setLoading();
		const result = await stock.save();
		if (result.ok) controls.setSuccess(`Saved ${formatCount(result.data, UNIT.item)}`, { token });
		else controls.setError(result.error, { token });
	};

	const open = stock.hasChanges || controls.status !== "idle";
	const message = stock.hasChanges
		? formatCount(stock.changedIds.size, UNIT.change)
		: controls.status === "error"
			? "Stock not saved"
			: controls.status === "success"
				? "Stock saved"
				: "Saving stock";

	return (
		<SaveBar
			open={open}
			message={message}
			onDiscard={stock.hasChanges ? stock.discard : undefined}
			busy={stock.isSaving}
		>
			<SaveButton onClick={save} disabled={!stock.hasChanges} />
		</SaveBar>
	);
}

/** "was 5" for a changed count, for the row's meta line. */
export function startingCountNote(stock: StockCount, dessertId: number) {
	return stock.changedIds.has(dessertId) ? `was ${stock.startingCount(dessertId)}` : null;
}

/** One dessert's stock today: a count field, or "Unlimited" for a dessert that isn't counted. */
export function StockField({ stock, dessert }: { stock: StockCount; dessert: CountableDessert & { name: string } }) {
	if (!isCounted(dessert)) {
		return (
			<span className="inline-flex w-18 items-center justify-center text-meta text-muted-foreground md:w-20">
				Unlimited
			</span>
		);
	}

	return (
		<Input
			type="number"
			inputMode="numeric"
			min={0}
			max={MAX_STOCK_QUANTITY}
			step={1}
			aria-label={`Stock for ${dessert.name}`}
			value={stock.countText(dessert.id)}
			onChange={(event) => stock.edit(dessert.id, event.target.value)}
			onFocus={(event) => event.target.select()}
			className={cn(
				"w-18 [appearance:textfield] px-2 text-center font-semibold md:w-20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				stock.changedIds.has(dessert.id) && "border-primary bg-primary/5 ring-1 ring-primary/30",
			)}
		/>
	);
}

/** One row for every dessert on sale with unlimited stock, which has nothing to count, linking to Catalog. */
export function UnlimitedStockRow({ count, catalogHref }: { count: number; catalogHref: string }) {
	return (
		<ListRow
			href={catalogHref}
			title={`${formatCount(count, UNIT.dessert)} ${count === 1 ? "has" : "have"} unlimited stock`}
			meta="Not counted. Change it in Catalog."
		/>
	);
}
