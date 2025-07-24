import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";
import { toast } from "sonner";

import type { CartItem } from "@/lib/types";
import { Button } from "./ui/button";

interface BillProps {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
}

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function getUPIString(order: BillProps["order"]) {
	const transactionNote = `${order.items
		.map((item) => item.name)
		.join(", ")
		.slice(0, 30)}...`;

	const urlParams = new URLSearchParams();
	urlParams.set("pa", process.env.NEXT_PUBLIC_UPI_ID || "");
	urlParams.set("am", order.total.toString());
	urlParams.set("pn", "Cocoa Comaa");
	urlParams.set("tn", transactionNote);

	return `upi://pay?${urlParams.toString()}`;
}

export default function Bill({ order }: BillProps) {
	const UPI_STRING = getUPIString(order);
	const qrCodeRef = useRef<SVGSVGElement>(null);

	const copyOrderDetails = () => {
		if (order.items.length === 0) return navigator.clipboard.writeText("");

		const orderItemsText = order.items
			.map(
				(item) =>
					`${capitalize(item.name.trim())} × ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`,
			)
			.join("\n");
		const orderText = `${orderItemsText}\nDelivery Cost: ₹${order.deliveryCost.toFixed(2)}\n-----\nTotal: ₹${order.total.toFixed(2)}`;

		navigator.clipboard.writeText(orderText);
		toast.info("Order details copied to clipboard", {
			duration: 1000,
			icon: "👍",
			richColors: false,
		});
	};

	const copyQrCodeToClipboard = async () => {
		if (!qrCodeRef.current) return;

		try {
			console.log(UPI_STRING);
			// Create a canvas and draw the SVG on it
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			const svgData = new XMLSerializer().serializeToString(qrCodeRef.current);
			const img = new Image(500, 500);
			// Convert SVG to data URL
			const svgBlob = new Blob([svgData], {
				type: "image/svg+xml;charset=utf-8",
			});
			const url = URL.createObjectURL(svgBlob);

			// Wait for image to load then copy to clipboard
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = url;
			});

			// 1 inch padding on all sides (96 DPI = 96 pixels per inch)
			const padding = 96;
			canvas.width = img.width + padding * 2;
			canvas.height = img.height + padding * 2;

			// Set white background
			if (ctx) {
				ctx.fillStyle = "white";
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw the QR code centered with padding
				ctx.fillStyle = "black";
				ctx.drawImage(img, padding, padding);

				// Draw border around the image (after QR code so it's on top)
				ctx.strokeStyle = "black";
				ctx.lineWidth = 4;
				ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
			}

			// Convert to blob and copy to clipboard
			canvas.toBlob(async (blob) => {
				if (blob) {
					await navigator.clipboard.write([
						new ClipboardItem({ "image/png": blob }),
					]);
				}
			}, "image/png");

			URL.revokeObjectURL(url);
			toast.info("QR code copied to clipboard", {
				duration: 1000,
				icon: "👍",
				richColors: false,
			});
		} catch (err) {
			console.error("Failed to copy QR code:", err);
			toast.error("Failed to copy QR code");
		}
	};

	return (
		<div>
			{/* Order Details Section */}
			<div className="flex gap-4 items-center justify-between">
				<Button
					onClick={copyOrderDetails}
					type="button"
					size="sm"
					variant="outline"
				>
					Copy Order
				</Button>
				<Button
					onClick={copyQrCodeToClipboard}
					type="button"
					size="sm"
					variant="outline"
				>
					Copy UPI
				</Button>
			</div>

			{/* QR Code Section */}
			<QRCodeSVG
				ref={qrCodeRef}
				value={UPI_STRING}
				size={500}
				className="hidden"
			/>
		</div>
	);
}
