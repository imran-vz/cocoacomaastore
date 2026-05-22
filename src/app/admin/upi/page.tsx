import { RedirectType, redirect } from "next/navigation";

export default function UpiRedirectPage() {
	redirect("/admin/settings/upi", RedirectType.replace);
}
