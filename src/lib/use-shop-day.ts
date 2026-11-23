"use client";

import { createParser, useQueryState } from "nuqs";
import { useCallback } from "react";
import { type DayKey, parseDayKey } from "@/lib/shop-calendar";
import { useShopToday } from "@/lib/use-shop-today";

const dayParam = createParser({ parse: parseDayKey, serialize: (day: DayKey) => day });

/**
 * The shop day a page shows: the day picked in the URL's `param` when `canPick`, otherwise the shop's
 * today, which moves on at midnight while the page stays open. Picking today clears the URL, so the
 * page follows today again.
 */
export function useShopDay(param: string, serverToday: DayKey, canPick = true) {
	const today = useShopToday(serverToday);
	const [picked, setPicked] = useQueryState(param, dayParam);
	const day = canPick ? (picked ?? today) : today;
	const setDay = useCallback((next: DayKey) => void setPicked(next === today ? null : next), [setPicked, today]);
	return { day, today, setDay };
}
