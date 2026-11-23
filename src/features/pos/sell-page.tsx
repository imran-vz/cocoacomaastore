import { getDesserts, getEnabledCombos } from "@/features/catalog/queries";
import { getTodayInventory } from "@/features/inventory/daily-inventory";
import { PosHome } from "@/features/pos/pos-home";
import { getCheckoutUpiAccounts } from "@/features/upi/queries";
import { snapshot } from "@/lib/server-snapshot";

/** The Sell screen for any staff area. Data streams in; the route's loading state shows the skeleton. */
export function SellPage() {
	return (
		<PosHome
			desserts={getDesserts()}
			upiAccounts={getCheckoutUpiAccounts()}
			inventory={snapshot(getTodayInventory())}
			combos={getEnabledCombos()}
		/>
	);
}
