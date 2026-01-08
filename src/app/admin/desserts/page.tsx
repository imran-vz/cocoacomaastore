import type { Metadata } from "next";

import { getCachedDesserts } from "@/app/desserts/actions";
import ManageDesserts from "./manage-desserts";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Dessert Management",
	description: "Dessert Management",
};

export default async function page() {
	const desserts = getCachedDesserts({
		shouldShowDisabled: true,
	});

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<ManageDesserts initialDesserts={desserts} />
		</main>
	);
}
