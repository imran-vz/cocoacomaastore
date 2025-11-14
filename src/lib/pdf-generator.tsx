import satori, { type SatoriOptions } from "satori";
import { blobStream, PDFDocument } from "./pdfkit";
import type { CartItem } from "./types";

interface ReceiptData {
	order: {
		items: CartItem[];
		total: number;
		deliveryCost: number;
	};
	qrCodeDataUrl: string;
}

// Generate receipt SVG with UPI QR code
async function generateReceiptSVG(
	data: ReceiptData,
	items: CartItem[],
	isLastPage: boolean,
) {
	const { order, qrCodeDataUrl } = data;

	// Fetch font data
	const fontData = await fetch("/GeistMono-Regular.ttf").then((res) =>
		res.arrayBuffer(),
	);

	const currentDate = new Date();
	const dateStr = currentDate.toLocaleDateString();
	const timeStr = currentDate.toLocaleTimeString();

	// Shared styles
	const separatorStyle = {
		width: "100%",
		height: "1px",
		backgroundColor: "#d1d5db",
		margin: "20px 0",
	};

	const config = {
		width: 595,
		height: 842,
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
				padding: "40px",
				backgroundColor: "white",
				fontFamily: "GeistMono",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					border: "2px dashed #d1d5db",
					borderRadius: "8px",
					padding: "30px",
					backgroundColor: "white",
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						marginBottom: "20px",
					}}
				>
					<h1 style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>
						COCOA COMAA
					</h1>
				</div>

				<div style={separatorStyle} />

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
						Date: {dateStr}
					</div>
					<div style={{ display: "flex" }}>Time: {timeStr}</div>
				</div>

				<div style={separatorStyle} />

				{/* Items Table - only show if there are items */}
				{items.length > 0 && (
					<>
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
									fontWeight: "bold",
									fontSize: "14px",
									marginBottom: "10px",
								}}
							>
								<div style={{ display: "flex", width: "280px" }}>Item</div>
								<div
									style={{
										display: "flex",
										width: "50px",
										justifyContent: "center",
									}}
								>
									Qty
								</div>
								<div
									style={{
										display: "flex",
										width: "100px",
										justifyContent: "flex-end",
									}}
								>
									Price
								</div>
							</div>

							{/* Table Rows */}
							{items.map((item) => (
								<div
									key={item.id}
									style={{
										display: "flex",
										fontSize: "14px",
										marginBottom: "6px",
									}}
								>
									<div
										style={{
											display: "flex",
											width: "280px",
											overflow: "hidden",
										}}
									>
										{item.name}
									</div>
									<div
										style={{
											display: "flex",
											width: "50px",
											justifyContent: "center",
										}}
									>
										{item.quantity}
									</div>
									<div
										style={{
											display: "flex",
											width: "100px",
											justifyContent: "flex-end",
										}}
									>
										₹{(item.price * item.quantity).toFixed(2)}
									</div>
								</div>
							))}
						</div>

						<div style={separatorStyle} />
					</>
				)}

				{/* Show summary only on last page */}
				{isLastPage && (
					<>
						{/* Delivery Cost - only if > 0 */}
						{order.deliveryCost > 0 && (
							<>
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
								<div style={separatorStyle} />
							</>
						)}

						{/* Total */}
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								fontWeight: "bold",
								fontSize: "18px",
								marginBottom: "20px",
							}}
						>
							<span>Total:</span>
							<span>₹{order.total.toFixed(2)}</span>
						</div>

						<div style={separatorStyle} />

						{/* QR Code Section */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								marginTop: "20px",
							}}
						>
							<div
								style={{
									display: "flex",
									fontSize: "16px",
									marginBottom: "15px",
									fontWeight: "bold",
								}}
							>
								Pay with UPI
							</div>
							{/** biome-ignore lint/performance/noImgElement: This is a valid use case */}
							<img
								src={qrCodeDataUrl}
								alt="UPI QR Code"
								style={{
									width: "180px",
									height: "180px",
									border: "3px solid #000",
									padding: "10px",
									backgroundColor: "white",
								}}
							/>
						</div>
					</>
				)}
			</div>
		</div>,
		config,
	);

	return svg;
}

const ITEMS_PER_PAGE = 7;

export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
	const { order } = data;

	// Split items into pages
	const itemChunks: CartItem[][] = [];
	for (let i = 0; i < order.items.length; i += ITEMS_PER_PAGE) {
		itemChunks.push(order.items.slice(i, i + ITEMS_PER_PAGE));
	}

	// Add extra page for summary if there are items
	const totalPages = order.items.length > 0 ? itemChunks.length + 1 : 1;

	// Generate all page SVGs and convert to data URLs
	const pageDataUrls: string[] = [];
	for (let i = 0; i < totalPages; i++) {
		const isLastPage = i === totalPages - 1;

		// For last page (summary page), pass empty items array
		const pageItems = isLastPage ? [] : itemChunks[i];
		const svg = await generateReceiptSVG(data, pageItems, isLastPage);

		// Convert SVG to data URL
		const svgBase64 = btoa(
			new TextEncoder()
				.encode(svg)
				.reduce((data, byte) => data + String.fromCharCode(byte), ""),
		);
		pageDataUrls.push(`data:image/svg+xml;base64,${svgBase64}`);
	}

	// Use PDFKit in browser to generate PDF

	return new Promise((resolve, reject) => {
		try {
			// Create PDF document (A4 size: 595 x 842 points)
			const doc = new PDFDocument({
				size: "A4",
				margin: 0,
			});

			// Create blob stream
			const stream = doc.pipe(blobStream());

			let pagesProcessed = 0;

			// Process pages sequentially
			const processPage = (pageIndex: number) => {
				const svgDataUrl = pageDataUrls[pageIndex];

				// Load and embed the SVG image at high resolution
				const img = new Image();
				img.onload = () => {
					// Use 2x resolution for sharper output
					const canvas = document.createElement("canvas");
					canvas.width = 595 * 2;
					canvas.height = 842 * 2;
					const ctx = canvas.getContext("2d");

					if (ctx) {
						// Enable image smoothing for better quality
						ctx.imageSmoothingEnabled = true;
						ctx.imageSmoothingQuality = "high";

						ctx.drawImage(img, 0, 0, 595 * 2, 842 * 2);
						canvas.toBlob((blob) => {
							if (blob) {
								const reader = new FileReader();
								reader.onload = () => {
									// Add new page if not first
									if (pageIndex > 0) {
										doc.addPage();
									}

									// Scale down to A4 size while maintaining quality
									doc.image(reader.result as ArrayBuffer, 0, 0, {
										width: 595,
										height: 842,
									});

									pagesProcessed++;

									// Process next page or end document
									if (pagesProcessed === totalPages) {
										doc.end();
									} else {
										processPage(pagesProcessed);
									}
								};
								reader.readAsArrayBuffer(blob);
							}
						}, "image/png");
					}
				};

				img.onerror = reject;
				img.src = svgDataUrl;
			};

			// Start with first page
			processPage(0);

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
