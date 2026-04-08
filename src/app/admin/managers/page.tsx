import { getCachedManagers } from "./actions";
import ManagerClientPage from "./component/manager-client-page";

export default function ManagersPage() {
	const managers = getCachedManagers();
	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<ManagerClientPage managers={managers} />
		</main>
	);
}
