"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { todayInventoryQuery } from "@/features/inventory/client";
import type { DayInventory } from "@/features/inventory/shapes";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";
import { useShopToday } from "@/lib/use-shop-today";

/**
 * Today's stored stock, kept fresh in the background and shared by every screen that shows it. The
 * server decides which day is today; the counts are refetched when the shop's day moves on.
 */
export function useTodayInventory(initialInventory: ServerSnapshot<DayInventory>) {
	const [answeredDay, setAnsweredDay] = useState(initialInventory.data.dayKey);
	const { data, isRefetchError, refetch } = useSeededQuery(todayInventoryQuery(answeredDay), initialInventory);
	if (data.dayKey !== answeredDay) setAnsweredDay(data.dayKey);

	const today = useShopToday(data.dayKey);
	useEffect(() => {
		if (today > data.dayKey) void refetch();
	}, [today, data.dayKey, refetch]);

	const quantityByDessertId = useMemo(
		() => new Map(data.rows.map(({ dessertId, quantity }) => [dessertId, quantity])),
		[data.rows],
	);

	const storedCount = useCallback(
		(dessertId: number) => quantityByDessertId.get(dessertId) ?? 0,
		[quantityByDessertId],
	);

	return {
		dayKey: data.dayKey,
		quantityByDessertId,
		/** Stored count for a dessert today; no row means none in stock. */
		storedCount,
		refresh: refetch,
		/** The last background refresh failed, so the counts shown may be out of date. */
		refreshFailed: isRefetchError,
	};
}

export type TodayInventory = ReturnType<typeof useTodayInventory>;
