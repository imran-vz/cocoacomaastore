import satori, { type SatoriOptions } from "satori";
import type { UpiAccount } from "@/db/schema";
import type { CartItem } from "./types";

interface BillData {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
	selectedAccount: UpiAccount;
	qrCodeDataUrl: string;
}

interface ReceiptData {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
	selectedAccount: UpiAccount;
	qrCodeDataUrl: string;
}

const A4_WIDTH = 1200;
const A4_HEIGHT = 2400;

async function generateBillSVG(data: BillData) {
	const { order, selectedAccount, qrCodeDataUrl } = data;

	// Fetch font data
	const fontData = await fetch("/GeistMono-Regular.ttf").then((res) =>
		res.arrayBuffer(),
	);

	const currentDate = new Date();
	const dateStr = currentDate.toLocaleDateString();
	const timeStr = currentDate.toLocaleTimeString();

	const config = {
		width: A4_WIDTH / 2,
		height: A4_HEIGHT / 3,
		fonts: [
			{
				name: "GeistMono",
				data: fontData,
				weight: 400,
				style: "normal",
			},
		],
	} satisfies SatoriOptions;

	const svg = await satori(
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				padding: "30px",
				backgroundColor: "white",
				fontFamily: "GeistMono",
			}}
		>
			{/* Receipt Container with border */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					border: "2px dashed #d1d5db",
					borderRadius: "8px",
					padding: "20px",
					backgroundColor: "white",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						marginBottom: "20px",
					}}
				>
					<h1
						style={{
							fontSize: "24px",
							fontWeight: "bold",
							margin: 0,
						}}
					>
						COCOA COMAA
					</h1>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Date and Time */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						fontSize: "14px",
						marginBottom: "15px",
					}}
				>
					<div style={{ display: "flex", marginBottom: "4px" }}>
						<span>Date: {dateStr}</span>
					</div>
					<div style={{ display: "flex" }}>
						<span>Time: {timeStr}</span>
					</div>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Items Table */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						marginBottom: "15px",
					}}
				>
					{/* Table Header */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontWeight: "bold",
							fontSize: "14px",
							marginBottom: "10px",
						}}
					>
						<span style={{ flex: 1, textAlign: "left" }}>Item</span>
						<span style={{ width: "50px", textAlign: "center" }}>Qty</span>
						<span style={{ width: "80px", textAlign: "right" }}>Price</span>
					</div>

					{/* Table Rows */}
					{order.items.map((item) => (
						<div
							key={item.id}
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "14px",
								marginBottom: "6px",
							}}
						>
							<span
								style={{
									flex: 1,
									textAlign: "left",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{item.name}
							</span>
							<span style={{ width: "50px", textAlign: "center" }}>
								{item.quantity}
							</span>
							<span style={{ width: "80px", textAlign: "right" }}>
								{(item.price * item.quantity).toFixed(2)}
							</span>
						</div>
					))}
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Delivery Cost */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontWeight: "bold",
						fontSize: "16px",
						marginBottom: "15px",
					}}
				>
					<span>Delivery Cost:</span>
					<span>₹{order.deliveryCost.toFixed(2)}</span>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Total */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontWeight: "bold",
						fontSize: "16px",
					}}
				>
					<span>Total:</span>
					<span>₹{order.total.toFixed(2)}</span>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "20px",
						marginBottom: "20px",
					}}
				/>

				{/* QR Code Section */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					<p
						style={{
							fontSize: "16px",
							marginBottom: "15px",
							fontWeight: "bold",
						}}
					>
						Pay with UPI: {selectedAccount.label}
					</p>
					{/** biome-ignore lint/performance/noImgElement: This is a valid use case */}
					<img
						src={qrCodeDataUrl}
						alt="UPI QR Code"
						style={{
							width: "200px",
							height: "200px",
							border: "3px solid #000",
							padding: "10px",
							backgroundColor: "white",
						}}
					/>
					<p
						style={{
							fontSize: "12px",
							color: "#666",
							marginTop: "10px",
							textAlign: "center",
						}}
					>
						{selectedAccount.upiId}
					</p>
				</div>
			</div>
		</div>,
		config,
	);

	return svg;
}

export async function generateBillPDF(data: BillData): Promise<Blob> {
	// Generate SVG using Satori
	const svg = await generateBillSVG(data);

	// Convert SVG to data URL (browser-compatible)
	const svgBase64 = btoa(
		new TextEncoder()
			.encode(svg)
			.reduce((data, byte) => data + String.fromCharCode(byte), ""),
	);
	const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

	// Use PDFKit in browser to generate PDF
	// Note: PDFKit needs to be imported dynamically in the browser
	const PDFDocument = (await import("pdfkit/js/pdfkit.standalone")).default;
	const blobStream = (await import("blob-stream")).default;

	return new Promise((resolve, reject) => {
		try {
			// Create PDF document (A4 size: 595 x 842 points)
			const doc = new PDFDocument({
				size: "A4",
				margin: 0,
			});

			// Create blob stream
			const stream = doc.pipe(blobStream());

			// Load and embed the SVG image at high resolution
			const img = new Image();
			img.onload = () => {
				// Use 2x resolution for sharper output
				const canvas = document.createElement("canvas");
				canvas.width = A4_WIDTH;
				canvas.height = A4_HEIGHT;
				const ctx = canvas.getContext("2d");

				if (ctx) {
					// Enable image smoothing for better quality
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = "high";

					ctx.drawImage(img, 0, 0, A4_WIDTH, A4_HEIGHT);
					canvas.toBlob((blob) => {
						if (blob) {
							const reader = new FileReader();
							reader.onload = () => {
								// Scale down to A4 size while maintaining quality
								doc.image(reader.result as ArrayBuffer, 0, 0, {
									width: 595,
									height: 842,
								});
								doc.end();
							};
							reader.readAsArrayBuffer(blob);
						}
					}, "image/png");
				}
			};

			img.onerror = reject;
			img.src = svgDataUrl;

			// When the stream is finished, resolve with the blob
			stream.on("finish", () => {
				const blob = stream.toBlob("application/pdf");
				resolve(blob);
			});

			stream.on("error", reject);
		} catch (error) {
			reject(error);
		}
	});
}

// Generate receipt SVG with UPI QR code
async function generateReceiptSVG(data: ReceiptData) {
	const { order, selectedAccount, qrCodeDataUrl } = data;

	// Fetch font data
	const fontData = await fetch("/GeistMono-Regular.ttf").then((res) =>
		res.arrayBuffer(),
	);

	const currentDate = new Date();
	const dateStr = currentDate.toLocaleDateString();
	const timeStr = currentDate.toLocaleTimeString();

	const config = {
		width: A4_WIDTH / 2,
		height: A4_HEIGHT / 3,
		fonts: [
			{
				name: "GeistMono",
				data: fontData,
				weight: 400,
				style: "normal",
			},
		],
	} satisfies SatoriOptions;

	const svg = await satori(
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				padding: "30px",
				backgroundColor: "white",
				fontFamily: "GeistMono",
			}}
		>
			{/* Receipt Container with border */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					border: "2px dashed #d1d5db",
					borderRadius: "8px",
					padding: "20px",
					backgroundColor: "white",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						marginBottom: "20px",
					}}
				>
					<h1
						style={{
							fontSize: "24px",
							fontWeight: "bold",
							margin: 0,
						}}
					>
						COCOA COMAA
					</h1>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Date and Time */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						fontSize: "14px",
						marginBottom: "15px",
					}}
				>
					<div style={{ display: "flex", marginBottom: "4px" }}>
						<span>Date: {dateStr}</span>
					</div>
					<div style={{ display: "flex" }}>
						<span>Time: {timeStr}</span>
					</div>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Items Table */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						marginBottom: "15px",
					}}
				>
					{/* Table Header */}
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontWeight: "bold",
							fontSize: "14px",
							marginBottom: "10px",
						}}
					>
						<span style={{ flex: 1, textAlign: "left" }}>Item</span>
						<span style={{ width: "50px", textAlign: "center" }}>Qty</span>
						<span style={{ width: "80px", textAlign: "right" }}>Price</span>
					</div>

					{/* Table Rows */}
					{order.items.map((item) => (
						<div
							key={item.id}
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontSize: "14px",
								marginBottom: "6px",
							}}
						>
							<span
								style={{
									flex: 1,
									textAlign: "left",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{item.name}
							</span>
							<span style={{ width: "50px", textAlign: "center" }}>
								{item.quantity}
							</span>
							<span style={{ width: "80px", textAlign: "right" }}>
								{(item.price * item.quantity).toFixed(2)}
							</span>
						</div>
					))}
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Delivery Cost */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontWeight: "bold",
						fontSize: "16px",
						marginBottom: "15px",
					}}
				>
					<span>Delivery Cost:</span>
					<span>₹{order.deliveryCost.toFixed(2)}</span>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "15px",
						marginBottom: "15px",
					}}
				/>

				{/* Total */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						fontWeight: "bold",
						fontSize: "16px",
					}}
				>
					<span>Total:</span>
					<span>₹{order.total.toFixed(2)}</span>
				</div>

				{/* Separator */}
				<div
					style={{
						width: "100%",
						height: "1px",
						backgroundColor: "#d1d5db",
						marginTop: "20px",
						marginBottom: "20px",
					}}
				/>

				{/* QR Code Section */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					<p
						style={{
							fontSize: "16px",
							marginBottom: "15px",
							fontWeight: "bold",
						}}
					>
						Pay with UPI: {selectedAccount.label}
					</p>
					{/** biome-ignore lint/performance/noImgElement: This is a valid use case */}
					<img
						src={qrCodeDataUrl}
						alt="UPI QR Code"
						style={{
							width: "200px",
							height: "200px",
							border: "3px solid #000",
							padding: "10px",
							backgroundColor: "white",
						}}
					/>
					<p
						style={{
							fontSize: "12px",
							color: "#666",
							marginTop: "10px",
							textAlign: "center",
						}}
					>
						{selectedAccount.upiId}
					</p>
				</div>
			</div>
		</div>,
		config,
	);

	return svg;
}

export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
	// Generate SVG using Satori
	const svg = await generateReceiptSVG(data);

	// Convert SVG to data URL (browser-compatible)
	const svgBase64 = btoa(
		new TextEncoder()
			.encode(svg)
			.reduce((data, byte) => data + String.fromCharCode(byte), ""),
	);
	const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

	// Use PDFKit in browser to generate PDF
	const PDFDocument = (await import("pdfkit/js/pdfkit.standalone")).default;
	const blobStream = (await import("blob-stream")).default;

	return new Promise((resolve, reject) => {
		try {
			// Create PDF document (A4 size: 595 x 842 points)
			const doc = new PDFDocument({
				size: "A4",
				margin: 0,
			});

			// Create blob stream
			const stream = doc.pipe(blobStream());

			// Load and embed the SVG image at high resolution
			const img = new Image();
			img.onload = () => {
				// Use 2x resolution for sharper output
				const canvas = document.createElement("canvas");
				canvas.width = A4_WIDTH;
				canvas.height = A4_HEIGHT;
				const ctx = canvas.getContext("2d");

				if (ctx) {
					// Enable image smoothing for better quality
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = "high";

					ctx.drawImage(img, 0, 0, A4_WIDTH, A4_HEIGHT);
					canvas.toBlob((blob) => {
						if (blob) {
							const reader = new FileReader();
							reader.onload = () => {
								// Scale down to A4 size while maintaining quality
								doc.image(reader.result as ArrayBuffer, 0, 0, {
									width: 595,
									height: 842,
								});
								doc.end();
							};
							reader.readAsArrayBuffer(blob);
						}
					}, "image/png");
				}
			};

			img.onerror = reject;
			img.src = svgDataUrl;

			// When the stream is finished, resolve with the blob
			stream.on("finish", () => {
				const blob = stream.toBlob("application/pdf");
				resolve(blob);
			});

			stream.on("error", reject);
		} catch (error) {
			reject(error);
		}
	});
}
