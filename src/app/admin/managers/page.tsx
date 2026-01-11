import { getCachedManagers } from "./actions";
import ManagerClientPage from "./component/manager-client-page";

export default function ManagersPage() {
	const managers = getCachedManagers();
	return <ManagerClientPage managers={managers} />;
}
