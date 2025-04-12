import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";

import type { CartItem } from "@/lib/types";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface BillProps {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
}

export default function Bill({ order }: BillProps) {
	const UPI_STRING = `upi://pay?pa=Q525459501@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00&am=${order.total}`;
	const qrCodeRef = useRef<SVGSVGElement>(null);

	const copyOrderDetails = () => {
		const orderText = `${order.items
			.map(
				(item) =>
					`${item.name} × ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`,
			)
			.join(
				"\n",
			)}\nDelivery Cost: ₹${order.deliveryCost.toFixed(2)}\nTotal: ₹${order.total.toFixed(2)}`;

		navigator.clipboard.writeText(orderText);
	};

	const copyQrCodeToClipboard = async () => {
		if (!qrCodeRef.current) return;

		try {
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

			// add some padding on all sides to the canvas
			canvas.width = img.width + 20;
			canvas.height = img.height + 20;

			// center the image on the canvas
			ctx?.translate(canvas.width / 2, canvas.height / 2);
			ctx?.translate(-img.width / 2, -img.height / 2);
			ctx?.drawImage(img, 0, 0);

			// Convert to blob and copy to clipboard
			canvas.toBlob(async (blob) => {
				if (blob) {
					await navigator.clipboard.write([
						new ClipboardItem({ "image/png": blob }),
					]);
				}
			}, "image/png");

			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Failed to copy QR code:", err);
		}
	};

	return (
		<div className="space-y-8 p-4">
			{/* Order Details Section */}
			<div className="space-y-2">
				<div className="flex justify-between items-center">
					<h2 className="font-semibold text-lg">Order Details</h2>
					<Button onClick={copyOrderDetails} type="button">
						Copy Order
					</Button>
				</div>
				<div className="space-y-1">
					{order.items.map((item) => (
						<div key={item.id} className="flex justify-between">
							<span>
								{item.name} × {item.quantity}
							</span>
							<span>₹{(item.price * item.quantity).toFixed(2)}</span>
						</div>
					))}

					<Separator />
					<p className="text-sm text-muted-foreground inline-flex w-full justify-between">
						<span>Delivery Cost</span> <span>₹{order.deliveryCost}</span>
					</p>
					<Separator />

					<div className=" pt-2 font-semibold flex justify-between">
						<span>Total</span>
						<span>₹{order.total.toFixed(2)}</span>
					</div>
				</div>
			</div>

			{/* QR Code Section */}
			<div className="flex flex-col items-center space-y-2">
				<div className="flex gap-2 items-center">
					<h2 className="font-semibold text-lg">Scan to Pay</h2>
					<Button onClick={copyQrCodeToClipboard} type="button">
						Copy UPI
					</Button>
				</div>
				<QRCodeSVG
					ref={qrCodeRef}
					value={UPI_STRING}
					size={500}
					className="w-48 h-48"
				/>
			</div>
		</div>
	);
}
