import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts } from "@/lib/role-actions/admin-combos";
import { CombosSkeleton } from "../loading-skeletons";
import ManageCombos from "./manage-combos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Combos",
	description: "Dessert combos",
};

export default async function page() {
	const combos = getCachedAllCombos();
	const baseDesserts = getCachedBaseDesserts();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<AdminPageShell frame="narrow">
			<Suspense fallback={<CombosSkeleton includeMain={false} />}>
				<ManageCombos initialCombos={combos} baseDesserts={baseDesserts} modifierDesserts={modifierDesserts} />
			</Suspense>
		</AdminPageShell>
	);
}
