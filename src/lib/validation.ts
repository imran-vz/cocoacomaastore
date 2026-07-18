import { z } from "zod";
import { MAX_DELIVERY_COST, MAX_ORDER_CANCELLATION_REASON_LENGTH, MAX_ORDER_LINE_QUANTITY } from "@/lib/order-limits";
import type { OrderRequestLine } from "@/lib/types";

// ============================================================================
// Order Validation
// ============================================================================

const orderRequestLineSchema: z.ZodType<OrderRequestLine> = z
	.object({
		baseDessertId: z.number().int().positive(),
		comboId: z.number().int().positive().optional(),
		quantity: z.number().int().min(1).max(MAX_ORDER_LINE_QUANTITY),
	})
	.strict();

export const createOrderWithLinesSchema = z
	.object({
		submissionId: z.string().uuid(),
		customerName: z
			.string()
			.trim()
			.min(0)
			.max(255)
			.transform((val) => val || ""),
		lines: z.array(orderRequestLineSchema).min(1).max(100),
		deliveryCost: z
			.string()
			.regex(/^\d+(\.\d{1,2})?$/, "Invalid delivery cost format")
			.refine((val) => {
				const num = Number.parseFloat(val);
				return num >= 0 && num <= MAX_DELIVERY_COST;
			}, "Delivery cost must be between 0 and 999.99"),
	})
	.strict();

export const cancelOrderSchema = z.object({
	orderId: z.number().int().positive(),
	reason: z.string().trim().min(1).max(MAX_ORDER_CANCELLATION_REASON_LENGTH).optional(),
});

// ============================================================================
// Dessert Validation
// ============================================================================

export const createDessertSchema = z.object({
	name: z.string().trim().min(1).max(255),
	price: z.number().int().positive().max(1000000),
	description: z.string().trim().max(255).optional().nullable(),
	enabled: z.boolean().default(true),
	isOutOfStock: z.boolean().default(false),
	hasUnlimitedStock: z.boolean().default(false),
	kind: z.enum(["base", "modifier"]),
});

export const updateDessertSchema = z.object({
	id: z.number().int().positive(),
	data: z.object({
		name: z.string().trim().min(1).max(255),
		price: z.number().int().positive().max(1000000),
		description: z.string().trim().max(255).optional().nullable(),
		isOutOfStock: z.boolean(),
		hasUnlimitedStock: z.boolean(),
		kind: z.enum(["base", "modifier"]),
	}),
});

export const toggleDessertSchema = z.object({
	id: z.number().int().positive(),
	enabled: z.boolean(),
});

export const toggleOutOfStockSchema = z.object({
	id: z.number().int().positive(),
	isOutOfStock: z.boolean(),
});

export const deleteDessertSchema = z.object({
	id: z.number().int().positive(),
});

export const updateDessertSequenceSchema = z.object({
	id: z.number().int().positive(),
	newScore: z.number().int(),
});

// ============================================================================
// Manager Validation
// ============================================================================

export const createManagerSchema = z.object({
	name: z.string().trim().min(1).max(255),
	email: z.email().max(255).toLowerCase(),
	password: z.string().min(8).max(128),
	role: z.enum(["admin", "user"]),
});

export type CreateManagerSchema = z.infer<typeof createManagerSchema>;

export const deleteManagerSchema = z.object({
	id: z.string(),
});

// ============================================================================
// Inventory Validation
// ============================================================================

const inventoryUpdateSchema = z.object({
	dessertId: z.number().int().positive(),
	expectedQuantity: z.number().int().min(-2147483648).max(2147483647),
	quantity: z.number().int().min(0).max(10000),
});

export const upsertInventorySchema = z.object({
	updates: z
		.array(inventoryUpdateSchema)
		.min(1)
		.max(1000)
		.refine((updates) => new Set(updates.map(({ dessertId }) => dessertId)).size === updates.length, {
			message: "Duplicate dessert IDs are not allowed",
		}),
});

// ============================================================================
// UPI Validation
// ============================================================================

const upiIdRegex = /^[\w.-]+@[\w.-]+$/;

export const createUpiAccountSchema = z.object({
	label: z.string().trim().min(1).max(255),
	upiId: z.string().trim().min(3).max(255).regex(upiIdRegex, "Invalid UPI ID format (e.g., user@bank)"),
	enabled: z.boolean().optional().default(true),
});

export const updateUpiAccountSchema = z.object({
	id: z.uuid(),
	data: z.object({
		label: z.string().trim().min(1).max(255),
		upiId: z.string().trim().min(3).max(255).regex(upiIdRegex, "Invalid UPI ID format"),
		enabled: z.boolean(),
	}),
});

export const deleteUpiAccountSchema = z.object({
	id: z.string().uuid(),
});

// ============================================================================
// Combo Validation
// ============================================================================

export const createComboSchema = z.object({
	name: z.string().trim().min(1).max(255),
	baseDessertId: z.number().int().positive(),
	overridePrice: z.number().int().min(0).nullable().optional(),
	enabled: z.boolean().default(true),
});

export const updateComboSchema = z.object({
	id: z.number().int().positive(),
	data: z.object({
		name: z.string().trim().min(1).max(255),
		baseDessertId: z.number().int().positive(),
		overridePrice: z.number().int().min(0).nullable(),
		enabled: z.boolean(),
	}),
});

export const deleteComboSchema = z.object({
	id: z.number().int().positive(),
});

const comboItemSchema = z.object({
	dessertId: z.number().int().positive(),
	quantity: z.number().int().min(1).max(99),
});

export const updateComboItemsSchema = z.object({
	comboId: z.number().int().positive(),
	items: z.array(comboItemSchema).max(20),
});
