import { getDesserts } from "./actions";
import ManageDesserts from "./manage-desserts";

export const revalidate = 0;

export default async function page() {
	const desserts = await getDesserts();

	return <ManageDesserts initialDesserts={desserts} />;
}
