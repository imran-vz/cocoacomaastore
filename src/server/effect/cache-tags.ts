import { Effect } from "effect";
import { NextCache } from "@/server/effect/services/next-cache";

// ============================================================================
// Tag catalog — single source of truth for all Next.js cache tags
// ============================================================================

export const CacheTag = {
	orders: "orders",
	inventory: "inventory",
	dashboard: "dashboard",
	analytics: "analytics",
	combos: "combos",
	desserts: "desserts",
	managers: "managers",
	upiAccounts: "upi-accounts",
	upiAccountsAdmin: "upi-accounts-admin",
} as const;

// ============================================================================
// Domain tag groups — what to invalidate when a domain mutates
// ============================================================================

export const OrderTags = {
	mutation: [CacheTag.orders, CacheTag.inventory, CacheTag.dashboard, CacheTag.analytics] as const,
} as const;

const ComboTags = {
	mutation: [CacheTag.combos] as const,
	dessertRead: [CacheTag.desserts] as const,
} as const;

const DessertTags = {
	mutation: [CacheTag.desserts] as const,
} as const;

const InventoryTags = {
	mutation: [CacheTag.inventory] as const,
} as const;

const _ManagerTags = {
	mutation: [CacheTag.managers] as const,
} as const;

export const UpiTags = {
	mutation: [CacheTag.upiAccounts, CacheTag.upiAccountsAdmin] as const,
} as const;

export const DashboardTags = {
	stats: [CacheTag.orders, CacheTag.dashboard] as const,
	stock: [CacheTag.inventory, CacheTag.desserts, CacheTag.dashboard] as const,
	auditLogs: [CacheTag.inventory, CacheTag.dashboard] as const,
	dailyRevenue: [CacheTag.orders, CacheTag.dashboard] as const,
	monthlyRevenue: [CacheTag.orders, CacheTag.analytics] as const,
	weeklyRevenue: [CacheTag.orders, CacheTag.analytics] as const,
	monthlyDessertRevenue: [CacheTag.orders, CacheTag.analytics, CacheTag.desserts] as const,
	eodStock: [CacheTag.inventory, CacheTag.analytics] as const,
	availableMonths: [CacheTag.analytics] as const,
} as const;

export const AllCacheTags = [
	CacheTag.desserts,
	CacheTag.combos,
	CacheTag.inventory,
	CacheTag.orders,
	CacheTag.upiAccounts,
	CacheTag.upiAccountsAdmin,
	CacheTag.managers,
	CacheTag.dashboard,
	CacheTag.analytics,
] as const;

// ============================================================================
// Low-level Effect wrappers
// ============================================================================

export function revalidateTagsEffect(tags: readonly string[]) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.revalidateTags(tags);
	});
}

export function updateTagsEffect(tags: readonly string[]) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.updateTags(tags);
	});
}

export function updateNextCacheEffect({
	tags = [],
	paths = [],
}: {
	readonly tags?: readonly string[];
	readonly paths?: readonly string[];
}) {
	return Effect.gen(function* () {
		const cache = yield* NextCache;
		yield* cache.updateTags(tags);
		yield* cache.revalidatePaths(paths);
	});
}

// ============================================================================
// Pre-built domain invalidation effects
// ============================================================================

export function updateComboTagsEffect() {
	return updateTagsEffect(ComboTags.mutation);
}

export function updateDessertTagsEffect() {
	return updateTagsEffect(DessertTags.mutation);
}

export function updateInventoryTagsEffect() {
	return updateTagsEffect(InventoryTags.mutation);
}
