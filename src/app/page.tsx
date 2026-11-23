import { RedirectType, redirect } from "next/navigation";
import { homeOf, LOGIN_PATH } from "@/features/access/area";
import { getStaffUser } from "@/features/access/session";
import { withDatabase } from "@/features/shell/with-database";

export default function RootPage() {
	return withDatabase(getStaffUser(), (user) => redirect(user ? homeOf(user.area) : LOGIN_PATH, RedirectType.replace));
}
