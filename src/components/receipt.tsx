"use client";

import { Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { UpiAccount } from "@/db/schema";
import { generateReceiptPDF } from "@/lib/pdf-generator";
import type { CartItem } from "@/lib/types";
import { useUpiStore } from "@/store/upi-store";

interface ReceiptProps {
	cart: CartItem[];
	total: number;
	clearCart: () => void;
	deliveryCost: number;
	upiAccounts: UpiAccount[];
	customerName: string;
}

export function Receipt({
	cart,
	total,
	clearCart,
	deliveryCost,
	upiAccounts,
	customerName,
}: ReceiptProps) {
	const receiptRef = useRef<HTMLDivElement>(null);
	const qrCodeRef = useRef<SVGSVGElement>(null);
	const { selectedUpiId, setSelectedUpiId } = useUpiStore();

	// Initialize with first available account if selectedUpiId is invalid
	useEffect(() => {
		const isValid = upiAccounts.some(
			(account) => account.id.toString() === selectedUpiId,
		);
		if (!isValid && upiAccounts.length > 0) {
			setSelectedUpiId(upiAccounts[0].id.toString());
		}
	}, [upiAccounts, selectedUpiId, setSelectedUpiId]);

	const selectedAccount = upiAccounts.find(
		(account) => account.id.toString() === selectedUpiId,
	);

	const getUPIString = () => {
		const transactionNote = cart
			.map((item) => item.name)
			.join(", ")
			.slice(0, 30);

		const urlParams = new URLSearchParams();
		urlParams.set("pa", selectedAccount?.upiId || "");
		urlParams.set("am", total.toString());
		urlParams.set("pn", "Cocoa Comaa");
		urlParams.set("tn", transactionNote + "...");

		return `upi://pay?${urlParams.toString()}`;
	};

	const getQrCodeDataUrl = async (): Promise<string> => {
		if (!qrCodeRef.current) return "";

		const svgData = new XMLSerializer().serializeToString(qrCodeRef.current);
		const svgBlob = new Blob([svgData], {
			type: "image/svg+xml;charset=utf-8",
		});
		const url = URL.createObjectURL(svgBlob);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		const img = new Image(500, 500);

		await new Promise((resolve, reject) => {
			img.onload = resolve;
			img.onerror = reject;
			img.src = url;
		});

		const padding = 96;
		canvas.width = img.width + padding * 2;
		canvas.height = img.height + padding * 2;

		if (ctx) {
			ctx.fillStyle = "white";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "black";
			ctx.drawImage(img, padding, padding);
			ctx.strokeStyle = "black";
			ctx.lineWidth = 4;
			ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
		}

		URL.revokeObjectURL(url);
		return canvas.toDataURL("image/png");
	};

	const handleDownloadPDF = async () => {
		if (cart.length === 0 || !selectedAccount) return;

		try {
			toast.info("Generating PDF...", {
				duration: 2000,
				icon: "⏳",
				richColors: false,
			});

			const qrCodeDataUrl = await getQrCodeDataUrl();

			const pdfBlob = await generateReceiptPDF({
				order: {
					items: cart,
					total,
					deliveryCost,
				},
				qrCodeDataUrl,
			});

			// Create download link
			const url = URL.createObjectURL(pdfBlob);
			const a = document.createElement("a");
			a.href = url;

			// Generate filename with customer name if available
			const sanitizedName =
				customerName
					?.trim()
					?.replace(/[^a-z0-9]/gi, "_")
					?.toLowerCase() || "";

			const timestamp = Date.now();
			a.download = `receipt-${sanitizedName ? `${sanitizedName}-` : ""}${timestamp}.pdf`;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			toast.success("PDF downloaded successfully", {
				duration: 1000,
				icon: "✓",
				richColors: false,
			});
		} catch (err) {
			console.error("Failed to generate PDF:", err);
			toast.error("Failed to generate PDF");
		}
	};

	const handleNewOrder = () => {
		clearCart();
	};

	return (
		<div className="receipt-container">
			<div
				ref={receiptRef}
				className="bg-white p-3 font-mono text-xs border border-dashed border-gray-300 rounded-md"
			>
				<div className="text-center mb-3">
					<h3 className="font-bold text-base">COCOA COMAA</h3>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				<div className="mb-4">
					<p>Date: {new Date().toLocaleDateString()}</p>
					<p>Time: {new Date().toLocaleTimeString()}</p>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				<div className="space-y-1 mb-3">
					<table className="w-full">
						<thead>
							<tr className="font-bold">
								<th className="text-left">Item</th>
								<th className="text-center w-8">Qty</th>
								<th className="text-right w-16">Price</th>
							</tr>
						</thead>
						<tbody>
							{cart.map((item) => (
								<tr key={item.id}>
									<td className="truncate max-w-[150px]">{item.name}</td>
									<td className="text-center">{item.quantity}</td>
									<td className="text-right">
										{(item.price * item.quantity).toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<Separator className="my-4 h-px border-t border-gray-300" />

				{deliveryCost > 0 && (
					<>
						<div className="flex justify-between font-bold text-sm">
							<span>Delivery Cost:</span>
							<span>₹{deliveryCost.toFixed(2)}</span>
						</div>

						<Separator className="my-4 h-px border-t border-gray-300" />
					</>
				)}

				<div className="flex justify-between font-bold text-sm">
					<span>Total:</span>
					<span>₹{total.toFixed(2)}</span>
				</div>
			</div>

			{/* Hidden QR Code for PDF generation */}
			<QRCodeSVG
				ref={qrCodeRef}
				value={getUPIString()}
				size={500}
				className="hidden"
			/>

			<div className="flex gap-2 mt-4">
				<Button onClick={handleDownloadPDF} variant="outline">
					<Download className="mr-2 h-4 w-4" />
					PDF
				</Button>
				<Button onClick={handleNewOrder} className="flex-1">
					New Order
				</Button>
			</div>
		</div>
	);
}
