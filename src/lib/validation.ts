import { z } from "zod";

// ============================================================================
// Order Validation
// ============================================================================

// Legacy cart item schema - for backwards compatibility
export const cartItemSchema = z.object({
	id: z.number().int().positive(),
	name: z.string().min(1).max(255),
	price: z.number().int().positive(),
	quantity: z.number().int().min(1).max(99),
	hasUnlimitedStock: z.boolean(),
	inventoryQuantity: z.number().int().min(0).optional(),
});

// New cart line modifier schema
export const cartLineModifierSchema = z.object({
	dessertId: z.number().int().positive(),
	name: z.string().min(1).max(255),
	price: z.number().int().min(0),
	quantity: z.number().int().min(1).max(99),
});

// New cart line schema - supports base dessert + modifiers
export const cartLineSchema = z.object({
	cartLineId: z.string().min(1).max(100),
	baseDessertId: z.number().int().positive(),
	baseDessertName: z.string().min(1).max(255),
	baseDessertPrice: z.number().int().min(0),
	hasUnlimitedStock: z.boolean(),
	modifiers: z.array(cartLineModifierSchema).max(20),
	unitPrice: z.number().int().min(0),
	quantity: z.number().int().min(1).max(99),
	comboId: z.number().int().positive().optional(),
	comboName: z.string().max(255).optional(),
});

// New create order schema using cart lines
export const createOrderWithLinesSchema = z.object({
	customerName: z
		.string()
		.trim()
		.min(0)
		.max(255)
		.transform((val) => val || ""),
	lines: z.array(cartLineSchema).min(1).max(100),
	deliveryCost: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, "Invalid delivery cost format")
		.refine((val) => {
			const num = Number.parseFloat(val);
			return num >= 0 && num <= 10000;
		}, "Delivery cost must be between 0 and 10000"),
});

// Legacy create order schema - for backwards compatibility
export const createOrderSchema = z.object({
	customerName: z
		.string()
		.trim()
		.min(0)
		.max(255)
		.transform((val) => val || ""),
	items: z.array(cartItemSchema).min(1).max(100),
	deliveryCost: z
		.string()
		.regex(/^\d+(\.\d{1,2})?$/, "Invalid delivery cost format")
		.refine((val) => {
			const num = Number.parseFloat(val);
			return num >= 0 && num <= 10000;
		}, "Delivery cost must be between 0 and 10000"),
});

export const deleteOrderSchema = z.object({
	orderId: z.number().int().positive(),
});

export const cancelOrderSchema = z.object({
	orderId: z.number().int().positive(),
	reason: z.string().trim().min(1).max(500).optional(),
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

export const batchUpdateDessertSequencesSchema = z.object({
	updates: z
		.array(
			z.object({
				id: z.number().int().positive(),
				newScore: z.number().int(),
			}),
		)
		.min(1)
		.max(1000),
});

// ============================================================================
// Manager Validation
// ============================================================================

export const createManagerSchema = z.object({
	name: z.string().trim().min(1).max(255),
	email: z.string().email().max(255).toLowerCase(),
	password: z.string().min(8).max(128),
	role: z.enum(["admin", "manager"]),
});

export const deleteManagerSchema = z.object({
	id: z.string().uuid(),
});

// ============================================================================
// Inventory Validation
// ============================================================================

export const inventoryUpdateSchema = z.object({
	dessertId: z.number().int().positive(),
	quantity: z.number().int().min(0).max(10000),
});

export const upsertInventorySchema = z.object({
	updates: z.array(inventoryUpdateSchema).min(1).max(1000),
});

// ============================================================================
// UPI Validation
// ============================================================================

export const upiIdRegex = /^[\w.-]+@[\w.-]+$/;

export const createUpiAccountSchema = z.object({
	label: z.string().trim().min(1).max(255),
	upiId: z
		.string()
		.trim()
		.min(3)
		.max(255)
		.regex(upiIdRegex, "Invalid UPI ID format (e.g., user@bank)"),
	enabled: z.boolean().optional().default(true),
});

export const updateUpiAccountSchema = z.object({
	id: z.uuid(),
	data: z.object({
		label: z.string().trim().min(1).max(255),
		upiId: z
			.string()
			.trim()
			.min(3)
			.max(255)
			.regex(upiIdRegex, "Invalid UPI ID format"),
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

export const comboItemSchema = z.object({
	dessertId: z.number().int().positive(),
	quantity: z.number().int().min(1).max(99),
});

export const updateComboItemsSchema = z.object({
	comboId: z.number().int().positive(),
	items: z.array(comboItemSchema).max(20),
});

// ============================================================================
// Helper Types
// ============================================================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateOrderWithLinesInput = z.infer<
	typeof createOrderWithLinesSchema
>;
export type CartLineInput = z.infer<typeof cartLineSchema>;
export type CreateDessertInput = z.infer<typeof createDessertSchema>;
export type UpdateDessertInput = z.infer<typeof updateDessertSchema>;
export type CreateManagerInput = z.infer<typeof createManagerSchema>;
export type UpsertInventoryInput = z.infer<typeof upsertInventorySchema>;
export type CreateUpiAccountInput = z.infer<typeof createUpiAccountSchema>;
export type UpdateUpiAccountInput = z.infer<typeof updateUpiAccountSchema>;
export type CreateComboInput = z.infer<typeof createComboSchema>;
export type UpdateComboInput = z.infer<typeof updateComboSchema>;
export type UpdateComboItemsInput = z.infer<typeof updateComboItemsSchema>;
