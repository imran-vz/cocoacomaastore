import { Suspense } from "react";
import { PageFrame } from "@/components/page-frame";
import POSHome from "@/components/pos-home";
import { PosHomeSkeleton } from "@/components/pos-home-skeleton";
import { getCachedCombos } from "../combos/actions";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedUPIAccounts } from "../upi/actions";
import { getCachedTodayInventory } from "./inventory/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();
	const inventory = getCachedTodayInventory();
	const combos = getCachedCombos();

	return (
		// POSHome draws its own gutters (the sticky search row and the inline cart need them), so
		// the frame drops its padding and its inner column fills: edges match manager Orders.
		<PageFrame frame="wide" centered as="main" className="p-0 *:max-w-none md:p-0">
			<Suspense fallback={<PosHomeSkeleton />}>
				<POSHome desserts={desserts} upiAccounts={upiAccounts} inventory={inventory} combos={combos} />
			</Suspense>
		</PageFrame>
	);
}
