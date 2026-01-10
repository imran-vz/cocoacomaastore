import type { Metadata } from "next";

import {
	getCachedAllCombos,
	getCachedBaseDesserts,
	getCachedModifierDesserts,
} from "./actions";
import ManageCombos from "./manage-combos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Combo Management",
	description: "Manage dessert combos",
};

export default async function page() {
	const combos = getCachedAllCombos();
	const baseDesserts = getCachedBaseDesserts();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<ManageCombos
				initialCombos={combos}
				baseDesserts={baseDesserts}
				modifierDesserts={modifierDesserts}
			/>
		</main>
	);
}
