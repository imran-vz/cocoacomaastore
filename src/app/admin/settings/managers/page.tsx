import { Suspense } from "react";
import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { ManagersSkeleton } from "../../loading-skeletons";
import { getCachedManagers } from "./actions";
import ManagerClientPage from "./component/manager-client-page";

export default function ManagersPage() {
	const managers = getCachedManagers();
	return (
		<AdminPageShell>
			<Suspense fallback={<ManagersSkeleton includeMain={false} />}>
				<ManagerClientPage managers={managers} />
			</Suspense>
		</AdminPageShell>
	);
}
