/**
 * The cache tags every feature builds its tags from. Server reads carry tags in `unstable_cache`,
 * client queries in `meta.tags`, and a change refreshes the same tags in both: each feature's
 * `tags.ts` names what its reads carry and what its changes refresh.
 */
export const CacheTag = {
	orders: "orders",
	inventory: "inventory",
	analytics: "analytics",
	combos: "combos",
	desserts: "desserts",
	upiAccounts: "upi-accounts",
	/** Staff accounts are read uncached on the server, so only client queries carry this tag. */
	staffAccounts: "staff-accounts",
} as const;

export type CacheTagName = (typeof CacheTag)[keyof typeof CacheTag];

export const ALL_CACHE_TAGS: readonly CacheTagName[] = Object.values(CacheTag);

/**
 * How long a tagged read may be served before it is read again even without a tag refresh: a
 * backstop for a refresh that never arrived.
 */
export const TAGGED_READ_REVALIDATE_SECONDS = 60 * 60 * 24;
