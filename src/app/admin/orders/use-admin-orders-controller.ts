"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo, useState } from "react";
import type { CancelOrderHandler } from "@/components/orders/order-cancel-action";
import { formatLocalDateKey } from "@/lib/local-date";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { cancelOrder } from "./actions";
import { buildAdminOrdersViewModel, canCancelOnSelectedDate } from "./orders-view-model";

async function fetchAdminOrders(dateString: string, signal?: AbortSignal): Promise<SerializedOrders> {
	const response = await fetch(`/api/admin/orders?date=${encodeURIComponent(dateString)}`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch admin orders (${response.status})`);
	}

	return response.json();
}

const EMPTY_ORDERS: SerializedOrders = [];

function startOfToday() {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
}

export function useAdminOrdersController(initialOrders: SerializedOrders) {
	const queryClient = useQueryClient();
	const [today] = useState(startOfToday);
	const [selectedDate, setSelectedDate] = useState<Date>(today);
	const selectedDateString = useMemo(() => formatLocalDateKey(selectedDate), [selectedDate]);
	const {
		data: queriedOrders,
		error,
		isFetching,
		isPending,
		isPlaceholderData,
	} = useQuery({
		queryKey: ["admin-orders", selectedDateString],
		queryFn: ({ signal }) => fetchAdminOrders(selectedDateString, signal),
		initialData: selectedDateString === formatLocalDateKey(today) ? initialOrders : undefined,
		placeholderData: (previousData) => previousData,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});

	const [targetOrderId] = useQueryState("orderId", parseAsInteger);

	const cancelOrderMutation = useMutation({
		mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) => cancelOrder(orderId, reason),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: ["admin-orders", selectedDateString] });
		},
	});

	const cancelOrderWithInvalidation = useCallback<CancelOrderHandler>(
		async (orderId, reason) => {
			await cancelOrderMutation.mutateAsync({ orderId, reason });
		},
		[cancelOrderMutation],
	);

	if (error) {
		console.error("Failed to fetch orders:", error);
	}

	const orders = queriedOrders ?? EMPTY_ORDERS;
	const model = useMemo(() => buildAdminOrdersViewModel(orders), [orders]);

	return {
		model,
		// Show the skeleton only while there is no data for the selected date (first fetch
		// of a date, or a date switch still displaying the previous date's placeholder);
		// background refetches such as the post-cancel invalidation keep the daybook mounted.
		isLoading: isPending || (isFetching && isPlaceholderData),
		selectedDate,
		handleDateChange: setSelectedDate,
		targetOrderId,
		canCancelOrders: canCancelOnSelectedDate(selectedDate, today),
		cancelOrder: cancelOrderWithInvalidation,
	};
}
