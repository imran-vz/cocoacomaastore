import Home from "@/components/home";
import { getCachedDesserts } from "../_desserts/actions";
import { getCachedTodayInventory } from "../(manager)/inventory/actions";
import { getCachedUPIAccounts } from "../upi/actions";

export default function AdminPage() {
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
