"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { CancelOrderHandler } from "@/components/orders/order-cancel-action";
import type { SerializedOrders } from "@/lib/order-lifecycle";
import { cancelOrder } from "./actions";
import { buildManagerOrdersViewModel } from "./orders-view-model";

async function fetchManagerOrders(signal?: AbortSignal): Promise<SerializedOrders> {
	const response = await fetch("/api/manager/orders", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch manager orders (${response.status})`);
	}

	return response.json();
}

/** `todayLabel` comes from the server render (shop time), so the heading never mismatches on hydration. */
export function useManagerOrdersController(initialOrders: SerializedOrders, todayLabel: string) {
	const queryClient = useQueryClient();
	const {
		data: orders,
		error,
		isFetching,
		refetch,
	} = useQuery({
		queryKey: ["manager-orders", "today"],
		queryFn: ({ signal }) => fetchManagerOrders(signal),
		initialData: initialOrders,
		staleTime: 30_000,
		gcTime: 5 * 60_000,
	});
	const cancelOrderMutation = useMutation({
		mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) => cancelOrder(orderId, reason),
		onSettled: async () => {
			await queryClient.invalidateQueries({ queryKey: ["manager-orders", "today"] });
		},
	});

	if (error) {
		console.error("Failed to fetch manager orders:", error);
	}

	const refreshOrders = useCallback(() => {
		refetch();
	}, [refetch]);

	const cancelOrderWithInvalidation = useCallback<CancelOrderHandler>(
		async (orderId, reason) => {
			await cancelOrderMutation.mutateAsync({ orderId, reason });
		},
		[cancelOrderMutation],
	);

	const model = useMemo(() => buildManagerOrdersViewModel(orders, todayLabel), [orders, todayLabel]);

	return {
		model,
		error,
		isFetching,
		isBusy: isFetching || cancelOrderMutation.isPending,
		refreshOrders,
		cancelOrder: cancelOrderWithInvalidation,
	};
}
