import { getCachedUPIAccountsForAdmin } from "@/app/upi/actions";
import UpiClientPage from "./component/upi-client-page";

export default function UpiPage() {
	const upiAccounts = getCachedUPIAccountsForAdmin();

	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<UpiClientPage upiAccounts={upiAccounts} />
		</main>
	);
}
