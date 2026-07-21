"use client";

import { Download } from "lucide-react";

import { useReactiveButton } from "@/components/ui/reactive-button";
import { downloadOrderInvoice } from "@/lib/order-invoice";
import type { SerializedOrderDetails } from "@/lib/order-lifecycle";
import { cn } from "@/lib/utils";

export function OrderInvoiceButton({ order, className }: { order: SerializedOrderDetails; className?: string }) {
	const [button, ExportButton] = useReactiveButton({
		label: "Export PDF",
		icon: Download,
		loading: { label: "Preparing PDF..." },
		success: { label: "Downloaded" },
		error: { label: "Export failed" },
		feedbackStyle: "neutral",
	});

	const handleExport = async () => {
		if (button.status !== "idle") return;
		const token = button.setLoading();
		try {
			await downloadOrderInvoice(order);
			button.setSuccess("Downloaded", { token });
		} catch (error) {
			if (!button.setError("Export failed", { token })) return;
			console.error("Failed to export invoice:", error);
		}
	};

	return <ExportButton variant="outline" size="sm" className={cn("w-full", className)} onClick={handleExport} />;
}
