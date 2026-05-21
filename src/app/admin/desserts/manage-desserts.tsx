"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { use, useCallback } from "react";
import { DessertsTable } from "@/components/desserts-table";
import type { Dessert } from "@/lib/types";

const dessertsQueryKey = ["desserts", { shouldShowDisabled: true }] as const;

async function fetchDesserts(signal?: AbortSignal): Promise<Dessert[]> {
	const response = await fetch("/api/desserts?shouldShowDisabled=true", {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch desserts (${response.status})`);
	}

	return response.json();
}

export default function ManageDesserts({ initialDesserts }: { initialDesserts: Promise<Dessert[]> }) {
	const initial = use(initialDesserts);
	const queryClient = useQueryClient();
	const {
		data: desserts,
		error,
		refetch,
	} = useQuery({
		queryKey: dessertsQueryKey,
		queryFn: ({ signal }) => fetchDesserts(signal),
		initialData: initial,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});

	const setDesserts = useCallback(
		(updater: SetStateAction<Dessert[]>) => {
			queryClient.setQueryData<Dessert[]>(dessertsQueryKey, (current = []) =>
				typeof updater === "function" ? updater(current) : updater,
			);
		},
		[queryClient],
	);

	const refreshDesserts = useCallback(async () => {
		await refetch();
	}, [refetch]);

	if (error) {
		console.error("Failed to fetch desserts:", error);
	}

	return (
		<DessertsTable
			desserts={desserts}
			setDesserts={setDesserts}
			onRefetch={refreshDesserts}
			title="Desserts"
			subtitle="Manage your dessert inventory and visibility"
			maxWidth="max-w-4xl"
		/>
	);
}
