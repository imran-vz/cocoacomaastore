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
	day: (dayKey: string) => `${CacheTag.orders}:${dayKey}`,
	mutation: (dayKey: string) => [OrderTags.day(dayKey), InventoryTags.day(dayKey)],
};

const ComboTags = {
	mutation: [CacheTag.combos] as const,
	dessertRead: [CacheTag.desserts] as const,
} as const;

const DessertTags = {
	mutation: [CacheTag.desserts] as const,
} as const;

export const InventoryTags = {
	day: (dayKey: string) => `${CacheTag.inventory}:${dayKey}`,
};

const _ManagerTags = {
	mutation: [CacheTag.managers] as const,
} as const;

export const UpiTags = {
	mutation: [CacheTag.upiAccounts, CacheTag.upiAccountsAdmin] as const,
} as const;

// Closed-period reports change only after compilation (or a catalog edit).
// Broad tags remain available to explicit refresh operations.
export const DashboardTags = {
	report: (dayKey: string, isLive: boolean) => [
		CacheTag.dashboard,
		CacheTag.analytics,
		CacheTag.desserts,
		CacheTag.inventory,
		InventoryTags.day(dayKey),
		...(isLive ? [CacheTag.orders, OrderTags.day(dayKey)] : []),
	],
	monthlyRevenue: [CacheTag.analytics],
	weeklyRevenue: (liveDayKey?: string) => [
		CacheTag.analytics,
		...(liveDayKey ? [CacheTag.orders, OrderTags.day(liveDayKey)] : []),
	],
	monthlyDessertRevenue: [CacheTag.analytics, CacheTag.desserts],
	eodStock: [CacheTag.analytics, CacheTag.desserts],
	availableMonths: [CacheTag.analytics],
};

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

export function updateInventoryTagsEffect(dayKey: string) {
	return updateTagsEffect([InventoryTags.day(dayKey)]);
}
