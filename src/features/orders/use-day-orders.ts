"use client";

import { keepPreviousData, useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Area } from "@/features/access/area";
import { cancelOrder } from "@/features/orders/actions";
import { dayOrdersQuery } from "@/features/orders/client";
import { type CancelOrderHandler, canBrowsePastDays, type DayOrders } from "@/features/orders/contract";
import { ORDERS_DATE_PARAM } from "@/features/orders/links";
import { dayOrdersScreen } from "@/features/orders/presentation";
import { useRunAction } from "@/lib/action-result";
import type { ServerSnapshot } from "@/lib/server-snapshot";
import { useSeededQuery } from "@/lib/use-seeded-query";
import { useShopDay } from "@/lib/use-shop-day";

/**
 * The Orders page's day, its orders, refreshing and cancelling. Admins pick the day (kept in the
 * URL); everyone else, and an admin who has not picked one, follows the shop's today past midnight.
 */
export function useDayOrders(area: Area, initialSnapshot: ServerSnapshot<DayOrders>) {
	const initial = initialSnapshot.data;
	const runAction = useRunAction();
	const { day, today, setDay } = useShopDay(ORDERS_DATE_PARAM, initial.today, canBrowsePastDays(area));

	const query = useSeededQuery(
		{ ...dayOrdersQuery(day), placeholderData: keepPreviousData },
		day === initial.day ? initialSnapshot : undefined,
	);
	const { data, isPending, isFetching, isPlaceholderData, isRefetchError, refetch } = query;
	const screen = useMemo(
		() => dayOrdersScreen({ data, isPending, isFetching, isPlaceholderData, isRefetchError }),
		[data, isPending, isFetching, isPlaceholderData, isRefetchError],
	);

	const cancelMutation = useMutation({
		mutationFn: async ({ orderId, reason }: { orderId: number; reason?: string }) => {
			const result = await runAction(cancelOrder(orderId, reason), {
				fallback: "Couldn't cancel the order. Try again.",
			});
			// A refused cancel usually means the list is out of date (cancelled at another till), so it is reloaded.
			if (!result.ok) await refetch();
			return result;
		},
	});
	const { mutateAsync } = cancelMutation;
	const cancel = useCallback<CancelOrderHandler>((orderId, reason) => mutateAsync({ orderId, reason }), [mutateAsync]);

	const refresh = useCallback(() => void refetch(), [refetch]);

	return {
		day,
		setDay,
		today,
		screen,
		isRefreshing: isFetching || cancelMutation.isPending,
		refresh,
		cancel,
	};
}
