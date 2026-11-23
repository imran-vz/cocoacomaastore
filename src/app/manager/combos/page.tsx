import type { Metadata } from "next";
import { CombosRoute } from "@/features/catalog/catalog-routes";
import { pageMetadata } from "@/features/shell/routes";

export const metadata: Metadata = pageMetadata("/manager/combos");

export default function ManagerCombosPage() {
	return <CombosRoute area="manager" />;
}
