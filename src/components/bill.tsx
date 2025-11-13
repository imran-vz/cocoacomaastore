import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { UpiAccount } from "@/db/schema";
import type { CartItem } from "@/lib/types";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface BillProps {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
	upiAccounts: UpiAccount[];
}

function capitalize(str: string) {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function getUPIString(order: BillProps["order"], upiId: string) {
	const transactionNote = `${order.items
		.map((item) => item.name)
		.join(", ")
		.slice(0, 30)}...`;

	const urlParams = new URLSearchParams();
	urlParams.set("pa", upiId);
	urlParams.set("am", order.total.toString());
	urlParams.set("pn", "Cocoa Comaa");
	urlParams.set("tn", transactionNote);

	return `upi://pay?${urlParams.toString()}`;
}

const SELECTED_UPI_STORAGE_KEY = "cocoacomaa-selected-upi-id";

export default function Bill({ order, upiAccounts }: BillProps) {
	const [selectedUpiId, setSelectedUpiId] = useState(() => {
		// Try to load from localStorage
		if (typeof window !== "undefined") {
			const savedUpiId = localStorage.getItem(SELECTED_UPI_STORAGE_KEY);
			if (savedUpiId) {
				// Validate that the saved UPI account exists and is not deleted
				const isValid = upiAccounts.some(
					(account) => account.id.toString() === savedUpiId,
				);
				if (isValid) {
					return savedUpiId;
				}
			}
		}

		// Default to first available account
		return upiAccounts[0]?.id.toString() || "1";
	});
	const qrCodeRef = useRef<SVGSVGElement>(null);

	// Save to localStorage whenever selectedUpiId changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(SELECTED_UPI_STORAGE_KEY, selectedUpiId);
		}
	}, [selectedUpiId]);

	const selectedAccount = upiAccounts.find(
		(account) => account.id.toString() === selectedUpiId,
	);
	const UPI_STRING = getUPIString(
		order,
		selectedAccount?.upiId || upiAccounts[0]?.upiId || "",
	);

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
		<motion.div
			animate={{ height: order.items.length > 0 ? "auto" : 0 }}
			transition={{ duration: 0.3 }}
		>
			{/* Order Details Section */}
			<div className="flex gap-4 items-start justify-between">
				<Button
					onClick={copyOrderDetails}
					type="button"
					size="sm"
					variant="outline"
				>
					Copy Order
				</Button>
				<div className="flex flex-col gap-1 items-end">
					<div className="flex gap-0 items-center">
						<Button
							onClick={copyQrCodeToClipboard}
							type="button"
							size="sm"
							variant="outline"
							className="rounded-r-none border-r-0"
						>
							Copy UPI
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className="rounded-l-none px-2"
								>
									<ChevronDown className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{upiAccounts.map((account) => (
									<DropdownMenuItem
										key={account.id}
										onClick={() => setSelectedUpiId(account.id.toString())}
										className={
											selectedUpiId === account.id.toString() ? "bg-accent" : ""
										}
										asChild
									>
										<motion.div
											initial={{ opacity: 0, x: -10 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.2 }}
										>
											{account.label}
										</motion.div>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
					<motion.p
						key={selectedUpiId}
						initial={{ opacity: 0, y: -5 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.2 }}
						className="text-xs text-muted-foreground"
					>
						{selectedAccount?.label || "No UPI selected"}
					</motion.p>
				</div>
			</div>

			{/* QR Code Section */}
			<QRCodeSVG
				ref={qrCodeRef}
				value={UPI_STRING}
				size={500}
				className="hidden"
			/>
		</motion.div>
	);
}
