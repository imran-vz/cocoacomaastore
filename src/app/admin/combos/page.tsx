import type { Metadata } from "next";
import { CombosRoute } from "@/features/catalog/catalog-routes";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/admin/combos");

export default function AdminCombosPage() {
	return <CombosRoute area="admin" />;
}
