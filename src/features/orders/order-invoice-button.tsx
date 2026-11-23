"use client";

import { Download } from "lucide-react";
import { useReactiveButton } from "@/components/ui/reactive-button";
import { downloadOrderInvoice } from "@/features/orders/invoice";
import type { OrderView } from "@/features/orders/presentation";

export function OrderInvoiceButton({ order, className }: { order: OrderView; className?: string }) {
	const [button, ExportButton] = useReactiveButton({
		label: "Download invoice",
		icon: Download,
		loading: { label: "Preparing invoice…" },
		success: { label: "Downloaded" },
		error: { label: "Download failed" },
	});

	const handleExport = async () => {
		if (button.status !== "idle") return;
		const token = button.setLoading();
		try {
			await downloadOrderInvoice(order);
			button.setSuccess("Downloaded", { token });
		} catch (error) {
			if (!button.setError("Download failed", { token })) return;
			console.error("Failed to export invoice:", error);
		}
	};

	return <ExportButton variant="outline" className={className} onClick={handleExport} />;
}
