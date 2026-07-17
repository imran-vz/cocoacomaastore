"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export type CancelOrderHandler = (orderId: number, reason?: string) => Promise<void>;

export function useManagerOrdersController(initialOrders: SerializedOrders) {
	const queryClient = useQueryClient();
	const [todayLabel, setTodayLabel] = useState("");
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

	useEffect(() => {
		setTodayLabel(
			new Date().toLocaleDateString("en-IN", {
				weekday: "long",
				day: "numeric",
				month: "long",
				timeZone: "Asia/Kolkata",
			}),
		);
	}, []);

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
