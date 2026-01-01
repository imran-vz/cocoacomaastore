import Home from "@/components/home";
import { getCachedDesserts } from "../_desserts/actions";
import { getCachedUPIAccounts } from "../upi/actions";
import { getCachedTodayInventory } from "./inventory/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<Home
				desserts={desserts}
				upiAccounts={upiAccounts}
				inventory={inventory}
			/>
		</main>
	);
}
