import Home from "@/components/home";
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
		<main className="min-h-[calc(100vh-52px)] p-4 md:p-6 lg:p-8 max-w-7xl mx-auto bg-muted/5">
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
