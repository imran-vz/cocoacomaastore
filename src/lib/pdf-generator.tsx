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

const MAX_ITEMS_WITH_QR = 14; // Max items that fit on page with QR code
const ITEMS_PER_PAGE = 15; // Items per page when QR is on separate page
const PAGE_WIDTH = 595; // A4 width in points
const PAGE_HEIGHT = 842; // A4 height in points
const FONT_NAME = "GeistMono";
const FONT_PATH = "/GeistMono-Regular.ttf";

// Utility: draw a light separator line
function drawSeparator(
	doc: PDFKit.PDFDocument,
	x: number,
	y: number,
	width: number,
) {
	doc
		.save()
		.lineWidth(1)
		.strokeColor("#d1d5db")
		.moveTo(x, y)
		.lineTo(x + width, y)
		.stroke()
		.restore();
}

// Utility: draw one page (header, border, items/summary)
function drawReceiptPage(
	doc: PDFKit.PDFDocument,
	data: ReceiptData,
	items: CartItem[],
	isLastPage: boolean,
) {
	const { order, qrCodeDataUrl } = data;
	const currentDate = new Date();
	const dateStr = currentDate.toLocaleDateString();
	const timeStr = currentDate.toLocaleTimeString();

	const padding = 40;
	const containerX = padding;
	const containerY = padding;
	const containerWidth = PAGE_WIDTH - padding * 2;
	const containerHeight = PAGE_HEIGHT - padding * 2;

	doc
		.save()
		.lineWidth(2)
		.strokeColor("#d1d5db")
		.roundedRect(containerX, containerY, containerWidth, containerHeight, 8)
		.dash(4, { space: 4 })
		.stroke()
		.undash()
		.restore();

	doc.font(FONT_NAME).fillColor("#000");

	// Header
	doc.fontSize(32).text("COCOA COMAA", containerX, containerY + 20, {
		width: containerWidth,
		align: "center",
	});

	let y = containerY + 70;
	drawSeparator(doc, containerX, y, containerWidth);
	y += 20;

	// Date & Time block
	doc.fontSize(14);
	doc.text(`Date: ${dateStr}`, containerX + 10, y);
	y += 18;
	doc.text(`Time: ${timeStr}`, containerX + 10, y);
	y += 24;

	drawSeparator(doc, containerX, y, containerWidth);
	y += 20;

	// Items table (only if this page has items)
	if (items.length > 0) {
		const leftPadding = 10;
		const contentPadding = 40;
		const itemColWidth = 280;
		const qtyColWidth = 50;
		const priceColWidth = 120;

		// Header row
		doc.fontSize(14).font(FONT_NAME, "bold");

		doc.text("Item", containerX + leftPadding, y, {
			width: itemColWidth,
			align: "left",
		});
		doc.text("Qty", containerX + contentPadding + itemColWidth, y, {
			width: qtyColWidth,
			align: "center",
		});
		doc.text(
			"Price",
			containerX + contentPadding + itemColWidth + qtyColWidth,
			y,
			{ width: priceColWidth, align: "right" },
		);

		doc.font(FONT_NAME, "normal");
		y += 18;

		// Separator after headers
		drawSeparator(
			doc,
			containerX + leftPadding,
			y,
			containerWidth - leftPadding * 2,
		);
		y += 16;

		// Rows
		for (const item of items) {
			const lineHeight = 16;

			doc.text(item.name, containerX + leftPadding, y, {
				width: itemColWidth,
				align: "left",
				ellipsis: true,
			});

			doc.text(
				String(item.quantity),
				containerX + contentPadding + itemColWidth,
				y,
				{ width: qtyColWidth, align: "center" },
			);

			const lineTotal = item.price * item.quantity;
			doc.text(
				`₹${lineTotal.toFixed(2)}`,
				containerX + contentPadding + itemColWidth + qtyColWidth,
				y,
				{ width: priceColWidth, align: "right" },
			);

			y += lineHeight;
		}

		y += 12;
		drawSeparator(doc, containerX, y, containerWidth);
		y += 20;
	}

	// Summary & QR code only on last page
	if (isLastPage) {
		// Delivery cost (if > 0)
		if (order.deliveryCost > 0) {
			doc.fontSize(16).font(FONT_NAME, "bold");

			doc.text("Delivery Cost:", containerX + 10, y, {
				width: containerWidth / 2,
				align: "left",
			});
			doc.text(
				`₹${order.deliveryCost.toFixed(2)}`,
				containerX + 10 + containerWidth / 2,
				y,
				{ width: containerWidth / 2 - 10, align: "right" },
			);

			y += 22;
			drawSeparator(doc, containerX, y, containerWidth);
			y += 20;
		}

		// Total
		doc.fontSize(18).font(FONT_NAME, "bold");

		doc.text("Total:", containerX + 10, y, {
			width: containerWidth / 2,
			align: "left",
		});
		doc.text(
			`₹${order.total.toFixed(2)}`,
			containerX + 10 + containerWidth / 2 - 20,
			y,
			{ width: containerWidth / 2 - 10, align: "right" },
		);

		y += 28;
		drawSeparator(doc, containerX, y, containerWidth);
		y += 20;

		// QR section – centre aligned
		const qrSectionTop = y + 10;
		doc.fontSize(16).font(FONT_NAME, "bold");
		doc.text("Pay with UPI", containerX, qrSectionTop, {
			width: containerWidth,
			align: "center",
		});

		const qrSize = 180;
		const qrX = containerX + (containerWidth - qrSize) / 2;
		const qrY = qrSectionTop + 40; // Increased gap from 30 to 40

		if (qrCodeDataUrl) {
			doc
				.save()
				.lineWidth(1)
				.rect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
				.restore();

			// PDFKit in browser accepts data URLs
			doc.image(qrCodeDataUrl, qrX, qrY, {
				width: qrSize,
				height: qrSize,
			});
		}
	}
}

// PDF generation using only PDFKit
export async function generateReceiptPDF(data: ReceiptData): Promise<Blob> {
	const fontData = await fetch(FONT_PATH).then((res) => res.arrayBuffer());

	return new Promise((resolve, reject) => {
		try {
			const doc = new PDFDocument({ size: "A4", margin: 0 });

			const stream = doc.pipe(blobStream());

			doc.registerFont(FONT_NAME, fontData);

			// Pagination logic: if ≤6 items, show all + QR on one page
			// If >6 items, paginate with 7 items per page, QR on last page
			const itemCount = data.order.items.length;

			if (itemCount <= MAX_ITEMS_WITH_QR) {
				// Single page with all items + QR
				drawReceiptPage(doc, data, data.order.items, true);
			} else {
				// Multiple pages: split items, QR on last page
				const itemChunks: CartItem[][] = [];
				for (let i = 0; i < itemCount; i += ITEMS_PER_PAGE) {
					itemChunks.push(data.order.items.slice(i, i + ITEMS_PER_PAGE));
				}

				const totalPages = itemChunks.length + 1; // +1 for final page with QR

				for (let i = 0; i < totalPages; i++) {
					if (i > 0) {
						doc.addPage({ size: "A4", margin: 0 });
					}

					const isLastPage = i === totalPages - 1;
					const pageItems = isLastPage ? [] : itemChunks[i];

					drawReceiptPage(doc, data, pageItems, isLastPage);
				}
			}

			doc.end();

			stream.on("finish", () => {
				const blob = stream.toBlob("application/pdf");
				resolve(blob);
			});

			stream.on("error", reject);
		} catch (err) {
			reject(err);
		}
	});
}
