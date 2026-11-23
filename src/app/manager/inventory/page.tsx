import type { Metadata } from "next";
import { getCatalogDesserts } from "@/features/catalog/queries";
import { getTodayInventory } from "@/features/inventory/daily-inventory";
import { StockPage } from "@/features/inventory/stock-page";
import { pageMetadata } from "@/features/shell/routes";
import { snapshot } from "@/lib/server-snapshot";

export const metadata: Metadata = pageMetadata("/manager/inventory");

export default function Inventory() {
	return <StockPage desserts={snapshot(getCatalogDesserts())} inventory={snapshot(getTodayInventory())} />;
}
