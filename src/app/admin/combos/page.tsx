import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { CombosSkeleton } from "../loading-skeletons";
import { getCachedAllCombos, getCachedBaseDesserts, getCachedModifierDesserts } from "./actions";
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
		<AdminPageShell>
			<Suspense fallback={<CombosSkeleton includeMain={false} />}>
				<ManageCombos initialCombos={combos} baseDesserts={baseDesserts} modifierDesserts={modifierDesserts} />
			</Suspense>
		</AdminPageShell>
	);
}
