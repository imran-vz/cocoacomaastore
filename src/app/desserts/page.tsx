import type { Metadata } from "next";

import ManageDesserts from "./manage-desserts";
import { getDesserts } from "./actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export const metadata: Metadata = {
	title: "Dessert Management",
	description: "Dessert Management",
};

export default async function page() {
	const desserts = await getDesserts();

	return <ManageDesserts initialDesserts={desserts} />;
}
