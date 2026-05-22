import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import Home from "@/components/home";
import { getCachedCombos, getCachedModifierDesserts } from "../combos/actions";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedTodayInventory } from "../manager/inventory/actions";
import { getCachedUPIAccounts } from "../upi/actions";
import { AdminHomeSkeleton } from "./loading-skeletons";

export default function AdminPage() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();
	const combos = getCachedCombos();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<AdminPageShell>
			<Suspense fallback={<AdminHomeSkeleton includeMain={false} />}>
				<Home
					desserts={desserts}
					upiAccounts={upiAccounts}
					inventory={inventory}
					combos={combos}
					modifierDesserts={modifierDesserts}
				/>
			</Suspense>
		</AdminPageShell>
	);
}
