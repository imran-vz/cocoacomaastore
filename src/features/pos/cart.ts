import type { ComboWithDetails, Dessert } from "@/features/catalog/queries";
import { comboPriceOf } from "@/features/catalog/rules";
import { MAX_ORDER_LINE_QUANTITY, type OrderRequestLine } from "@/features/orders/contract";

/**
 * One line of the POS cart: a dessert, or a combo (`comboId`) built on a base dessert.
 * The price is snapshotted when the line is added; the server prices the order again from the catalog.
 */
export type CartLine = {
	cartLineId: string;
	/** The dessert whose stock the line uses: the dessert itself, or the combo's base. */
	baseDessertId: number;
	comboId?: number;
	name: string;
	hasUnlimitedStock: boolean;
	unitPrice: number;
	quantity: number;
};

export type SellableDessert = Pick<Dessert, "id" | "name" | "price" | "hasUnlimitedStock">;

export type SellableCombo = Pick<ComboWithDetails, "id" | "name" | "baseDessertId" | "overridePrice"> & {
	baseDessert: Pick<ComboWithDetails["baseDessert"], "price" | "hasUnlimitedStock">;
	items: readonly { quantity: number; dessert: { price: number } }[];
};

/** Today's stored count per dessert; a dessert without an entry has none. */
export type StockCounts = ReadonlyMap<number, number>;

/** A tile on the Sell grid. A dessert tile adds the plain dessert; a combo tile adds the combo. */
export type TileKey = `dessert:${number}` | `combo:${number}`;

export type CartState = {
	lines: CartLine[];
	/** Grows with every change the cashier makes (a save does not count), so a save can tell whether the cart changed under it. */
	version: number;
	/**
	 * Grows when a new order begins: the cart was cleared, emptied or saved. A retry of the same order
	 * keeps its submission id; a new order gets a new one.
	 */
	intentVersion: number;
	/** The latest change the cart refused. `id` grows with each refusal so a repeated one shows again. */
	rejection: { id: number; message: string; tile?: TileKey } | null;
};

export type CartEvent =
	| { type: "add-dessert"; dessert: SellableDessert; stock: StockCounts }
	| { type: "add-combo"; combo: SellableCombo; stock: StockCounts }
	| { type: "step-line"; cartLineId: string; delta: 1 | -1; stock: StockCounts }
	| { type: "remove-line"; cartLineId: string }
	| { type: "clear" }
	| { type: "acknowledge-save"; savedLines: readonly CartLine[] };

export const emptyCart: CartState = { lines: [], version: 0, intentVersion: 0, rejection: null };

const QUANTITY_LIMIT_MESSAGE = `Quantity cannot be greater than ${MAX_ORDER_LINE_QUANTITY}`;

export function tileKeyOf(line: CartLine): TileKey {
	return line.comboId === undefined ? `dessert:${line.baseDessertId}` : `combo:${line.comboId}`;
}

/** How many more units of `baseDessertId` the cart can take today: its stored count less what the cart already uses. */
export function remainingStock(
	lines: readonly CartLine[],
	baseDessert: { id: number; hasUnlimitedStock: boolean },
	stock: StockCounts,
): number {
	if (baseDessert.hasUnlimitedStock) return Number.POSITIVE_INFINITY;
	const used = lines.reduce((sum, line) => (line.baseDessertId === baseDessert.id ? sum + line.quantity : sum), 0);
	return (stock.get(baseDessert.id) ?? 0) - used;
}

/** Whether today's stored stock has any of `dessert` before the cart takes some. */
export function isInStock(dessert: { id: number; hasUnlimitedStock: boolean }, stock: StockCounts): boolean {
	return remainingStock([], dessert, stock) > 0;
}

function outOfStockMessage(baseDessertId: number, stock: StockCounts): string {
	const stored = stock.get(baseDessertId) ?? 0;
	return stored > 0 ? `Only ${stored} left` : "Out of stock — set today's inventory";
}

/** Why one more unit of `line` cannot be added, if it cannot. */
function refusalToAddOne(lines: readonly CartLine[], line: CartLine, stock: StockCounts): string | undefined {
	if (line.quantity >= MAX_ORDER_LINE_QUANTITY) return QUANTITY_LIMIT_MESSAGE;
	if (remainingStock(lines, { id: line.baseDessertId, hasUnlimitedStock: line.hasUnlimitedStock }, stock) <= 0) {
		return outOfStockMessage(line.baseDessertId, stock);
	}
	return undefined;
}

export function canAddOne(lines: readonly CartLine[], line: CartLine, stock: StockCounts): boolean {
	return refusalToAddOne(lines, line, stock) === undefined;
}

function changed(state: CartState, lines: CartLine[]): CartState {
	const emptied = state.lines.length > 0 && lines.length === 0;
	return {
		...state,
		lines,
		version: state.version + 1,
		intentVersion: emptied ? state.intentVersion + 1 : state.intentVersion,
	};
}

function refused(state: CartState, message: string, tile?: TileKey): CartState {
	return { ...state, rejection: { id: (state.rejection?.id ?? 0) + 1, message, tile } };
}

function addOne(state: CartState, candidate: CartLine, stock: StockCounts): CartState {
	const tile = tileKeyOf(candidate);
	const existing = state.lines.find((line) => tileKeyOf(line) === tile);
	const refusal = refusalToAddOne(state.lines, existing ?? { ...candidate, quantity: 0 }, stock);
	if (refusal) return refused(state, refusal, tile);
	return changed(
		state,
		existing
			? state.lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line))
			: [...state.lines, candidate],
	);
}

/** Takes off the units an acknowledged save covered, keeping whatever the cashier added since. */
function withoutSaved(lines: readonly CartLine[], savedLines: readonly CartLine[]): CartLine[] {
	const savedById = new Map(savedLines.map((line) => [line.cartLineId, line.quantity]));
	return lines.flatMap((line) => {
		const remaining = line.quantity - (savedById.get(line.cartLineId) ?? 0);
		return remaining > 0 ? [{ ...line, quantity: remaining }] : [];
	});
}

function newLineId(): string {
	return globalThis.crypto.randomUUID();
}

export function cartReducer(state: CartState, event: CartEvent): CartState {
	switch (event.type) {
		case "add-dessert": {
			const { dessert } = event;
			return addOne(
				state,
				{
					cartLineId: newLineId(),
					baseDessertId: dessert.id,
					name: dessert.name,
					hasUnlimitedStock: dessert.hasUnlimitedStock,
					unitPrice: dessert.price,
					quantity: 1,
				},
				event.stock,
			);
		}
		case "add-combo": {
			const { combo } = event;
			return addOne(
				state,
				{
					cartLineId: newLineId(),
					baseDessertId: combo.baseDessertId,
					comboId: combo.id,
					name: combo.name,
					hasUnlimitedStock: combo.baseDessert.hasUnlimitedStock,
					unitPrice: comboPriceOf(combo),
					quantity: 1,
				},
				event.stock,
			);
		}
		case "step-line": {
			const line = state.lines.find((candidate) => candidate.cartLineId === event.cartLineId);
			if (!line) return state;
			if (event.delta === 1) {
				const refusal = refusalToAddOne(state.lines, line, event.stock);
				if (refusal) return refused(state, refusal);
			}
			const quantity = line.quantity + event.delta;
			return changed(
				state,
				quantity > 0
					? state.lines.map((candidate) => (candidate === line ? { ...line, quantity } : candidate))
					: state.lines.filter((candidate) => candidate !== line),
			);
		}
		case "remove-line":
			return changed(
				state,
				state.lines.filter((line) => line.cartLineId !== event.cartLineId),
			);
		case "clear":
			return { ...state, lines: [], version: state.version + 1, intentVersion: state.intentVersion + 1 };
		case "acknowledge-save":
			return { ...state, lines: withoutSaved(state.lines, event.savedLines), intentVersion: state.intentVersion + 1 };
	}
}

/** What a line costs in paise. */
export function lineTotalCents(line: CartLine): number {
	return Math.round(line.unitPrice * 100) * line.quantity;
}

export function itemCount(lines: readonly CartLine[]): number {
	return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function orderRequestLines(lines: readonly CartLine[]): OrderRequestLine[] {
	return lines.map(({ baseDessertId, comboId, quantity }) =>
		comboId === undefined ? { baseDessertId, quantity } : { baseDessertId, comboId, quantity },
	);
}
