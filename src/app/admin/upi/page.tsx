import { getCachedUPIAccounts } from "@/app/upi/actions";
import UpiClientPage from "./component/upi-client-page";

export default function UpiPage() {
	const upiAccounts = getCachedUPIAccounts();

	return <UpiClientPage upiAccounts={upiAccounts} />;
}
