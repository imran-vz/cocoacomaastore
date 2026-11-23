import type { Metadata } from "next";
import { DessertsRoute } from "@/features/catalog/catalog-routes";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/manager/desserts");

export default function ManagerDessertsPage() {
	return <DessertsRoute area="manager" />;
}
