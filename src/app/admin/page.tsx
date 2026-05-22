import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import POSHome from "@/components/pos-home";
import { getCachedCombos } from "../combos/actions";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedTodayInventory } from "../manager/inventory/actions";
import { getCachedUPIAccounts } from "../upi/actions";
import { AdminHomeSkeleton } from "./loading-skeletons";

export default function AdminPage() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();
	const combos = getCachedCombos();

	return (
		<AdminPageShell className="p-0 pb-0">
			<Suspense fallback={<AdminHomeSkeleton includeMain={false} />}>
				<POSHome desserts={desserts} upiAccounts={upiAccounts} inventory={inventory} combos={combos} />
			</Suspense>
		</AdminPageShell>
	);
}
