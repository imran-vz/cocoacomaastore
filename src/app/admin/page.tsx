import Home from "@/components/home";
import { getCachedCombos, getCachedModifierDesserts } from "../combos/actions";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedTodayInventory } from "../manager/inventory/actions";
import { getCachedUPIAccounts } from "../upi/actions";

export default function AdminPage() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();
	const combos = getCachedCombos();
	const modifierDesserts = getCachedModifierDesserts();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<Home
				desserts={desserts}
				upiAccounts={upiAccounts}
				inventory={inventory}
				combos={combos}
				modifierDesserts={modifierDesserts}
			/>
		</main>
	);
}
