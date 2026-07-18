"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect } from "react";

import type { BaseDessert, ModifierDessert } from "@/lib/combo-service";
import type { ComboWithDetails } from "@/lib/types";
import { type ComboActions, useComboStore } from "@/store/combo-store";

// Server actions must have stable identity (a module-level constant in the caller),
// because they are a dependency of the store-init effect.
export type ComboServerActions = Omit<ComboActions, "refetchCombos">;

type ComboRole = "admin" | "manager";

type CombosPayload = {
	combos: ComboWithDetails[];
	baseDesserts: BaseDessert[];
	modifierDesserts: ModifierDessert[];
};

async function fetchCombosPayload(role: ComboRole, signal?: AbortSignal): Promise<CombosPayload> {
	const response = await fetch(`/api/${role}/combos`, {
		cache: "no-store",
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${role} combos (${response.status})`);
	}

	return response.json();
}

export function useManageCombos({
	role,
	initialCombos,
	baseDesserts,
	modifierDesserts,
	actions,
}: {
	role: ComboRole;
	initialCombos: Promise<ComboWithDetails[]>;
	baseDesserts: Promise<BaseDessert[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
	actions: ComboServerActions;
}) {
	const initialPayload = {
		combos: use(initialCombos),
		baseDesserts: use(baseDesserts),
		modifierDesserts: use(modifierDesserts),
	};
	const queryClient = useQueryClient();
	const { data, error } = useQuery({
		queryKey: [`${role}-combos`],
		queryFn: ({ signal }) => fetchCombosPayload(role, signal),
		initialData: initialPayload,
		staleTime: 60_000,
		gcTime: 10 * 60_000,
	});

	const { combos, searchTerm, toggleLoadingIds, init, setSearchTerm, openCreateModal, openEditModal, handleToggle } =
		useComboStore();

	useEffect(() => {
		init(data.combos, data.baseDesserts, data.modifierDesserts, {
			...actions,
			refetchCombos: async () => {
				const latest = await queryClient.fetchQuery({
					queryKey: [`${role}-combos`],
					queryFn: ({ signal }) => fetchCombosPayload(role, signal),
					staleTime: 0,
				});
				return latest.combos;
			},
		});
	}, [data, init, queryClient, actions, role]);

	if (error) {
		console.error(`Failed to fetch ${role} combos:`, error);
	}

	const filteredCombos = combos.filter((combo) => combo.name.toLowerCase().includes(searchTerm.toLowerCase()));

	return {
		filteredCombos,
		searchTerm,
		toggleLoadingIds,
		setSearchTerm,
		openCreateModal,
		openEditModal,
		handleToggle,
	};
}
