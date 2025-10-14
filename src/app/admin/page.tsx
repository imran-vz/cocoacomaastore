import Home from "@/components/home";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedUPIAccounts } from "../upi/actions";

export default function AdminPage() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<Home desserts={desserts} upiAccounts={upiAccounts} />
		</main>
	);
}
