import POSHome from "@/components/pos-home";
import { getCachedCombos, getCachedModifierDesserts } from "../combos/actions";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedUPIAccounts } from "../upi/actions";
import { getCachedTodayInventory } from "./inventory/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();
	const combos = getCachedCombos();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<main className="min-h-[calc(100vh-52px)] max-w-7xl mx-auto">
			<POSHome
				desserts={desserts}
				upiAccounts={upiAccounts}
				inventory={inventory}
				combos={combos}
				modifierDesserts={modifierDesserts}
			/>
		</main>
	);
}
