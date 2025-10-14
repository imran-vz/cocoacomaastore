import { getCachedUPIAccountsForAdmin } from "@/app/upi/actions";
import UpiClientPage from "./component/upi-client-page";

export default function UpiPage() {
	const upiAccounts = getCachedUPIAccountsForAdmin();

	return <UpiClientPage upiAccounts={upiAccounts} />;
}
