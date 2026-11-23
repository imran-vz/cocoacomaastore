import type { Metadata } from "next";
import { DessertsRoute } from "@/features/catalog/catalog-routes";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/admin/desserts");

export default function AdminDessertsPage() {
	return <DessertsRoute area="admin" />;
}
