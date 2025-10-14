import { getCachedManagers } from "@/app/manager/action";
import ManagersClientPage from "./component/managet-client-page";

export default function ManagersPage() {
	const managers = getCachedManagers();
	return <ManagersClientPage managers={managers} />;
}
