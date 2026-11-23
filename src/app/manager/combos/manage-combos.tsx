"use client";

import { CombosManager } from "@/components/combos-manager";
import type { ComboServerActions } from "@/components/use-manage-combos";
import type { BaseDessert, ModifierDessert } from "@/lib/combo-service";
import {
	createCombo,
	deleteCombo,
	toggleCombo,
	updateCombo,
	updateComboItems,
} from "@/lib/role-actions/manager-combos";
import type { ComboWithDetails } from "@/lib/types";

const comboActions: ComboServerActions = { createCombo, updateCombo, deleteCombo, toggleCombo, updateComboItems };

export default function ManageCombos(props: {
	initialCombos: Promise<ComboWithDetails[]>;
	baseDesserts: Promise<BaseDessert[]>;
	modifierDesserts: Promise<ModifierDessert[]>;
}) {
	return <CombosManager area="manager" actions={comboActions} {...props} />;
}
