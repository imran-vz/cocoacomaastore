import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { UpiAccountsSkeleton } from "../../loading-skeletons";
import { getCachedAdminUpiAccounts } from "./actions";
import UpiClientPage from "./component/upi-client-page";

export default function UpiPage() {
	const upiAccounts = getCachedAdminUpiAccounts();

	return (
		<AdminPageShell>
			<Suspense fallback={<UpiAccountsSkeleton includeMain={false} />}>
				<UpiClientPage upiAccounts={upiAccounts} />
			</Suspense>
		</AdminPageShell>
	);
}
