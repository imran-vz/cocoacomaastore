import { RedirectType, redirect } from "next/navigation";

export default function ManagersRedirectPage() {
	redirect("/admin/settings/managers", RedirectType.replace);
}
