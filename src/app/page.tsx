import Home from "@/components/home";
import { getCachedDesserts } from "./desserts/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const desserts = getCachedDesserts();

	return (
		<main className="min-h-screen p-3 pb-6 max-w-7xl mx-auto">
			<Home desserts={desserts} />
		</main>
	);
}
