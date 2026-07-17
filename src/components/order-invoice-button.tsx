"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { downloadOrderInvoice } from "@/lib/order-invoice";
import type { SerializedOrderDetails } from "@/lib/order-lifecycle";
import { cn } from "@/lib/utils";

export function OrderInvoiceButton({ order, className }: { order: SerializedOrderDetails; className?: string }) {
	const [isExporting, setIsExporting] = useState(false);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			await downloadOrderInvoice(order);
			toast.success(`Invoice #${order.id} downloaded`);
		} catch (error) {
			console.error("Failed to export invoice:", error);
			toast.error("Could not export the invoice PDF");
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			className={cn("w-full", className)}
			onClick={handleExport}
			disabled={isExporting}
		>
			{isExporting ? <Spinner className="size-4" /> : <Download className="size-4" />}
			{isExporting ? "Preparing PDF..." : "Export PDF"}
		</Button>
	);
}
