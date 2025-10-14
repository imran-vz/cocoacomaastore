import { redirect } from "next/navigation";
import Home from "@/components/home";
import { authClient } from "@/lib/auth-client";
import { getCachedDesserts } from "../desserts/actions";
import { getCachedUPIAccounts } from "../upi/actions";

export const dynamic = "force-dynamic"; // forces dynamic rendering

export default async function page() {
	const { data } = await authClient.getSession();
	if (!data?.user) {
		redirect("/login");
	}
	if (data?.user.role !== "manager") {
		redirect("/admin");
	}

	const desserts = getCachedDesserts();
	const upiAccounts = getCachedUPIAccounts();

	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<Home desserts={desserts} upiAccounts={upiAccounts} />
		</main>
	);
}
