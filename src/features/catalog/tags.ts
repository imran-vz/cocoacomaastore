import { CacheTag } from "@/lib/cache-tags";

/** What dessert writes refresh, and what dessert reads carry. */
export const DESSERT_TAGS = [CacheTag.desserts];
/** What combo writes refresh. */
export const COMBO_TAGS = [CacheTag.combos];
/** Combos embed their desserts' names, prices and availability, so dessert writes refresh combo reads too. */
export const COMBO_READ_TAGS = [...COMBO_TAGS, ...DESSERT_TAGS];
