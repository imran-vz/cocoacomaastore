import type { jsPDF as JsPdfDocument } from "jspdf";

import { BRAND_NAME } from "@/components/ui/brand";
import type { OrderLineView, OrderView } from "@/features/orders/presentation";
import { formatDate, formatTime } from "@/lib/format";
import { rupees } from "@/lib/money";

export type InvoiceAssets = {
	font: Uint8Array;
	logo: Uint8Array;
};

type PdfDependencies = {
	jsPDF: typeof import("jspdf").jsPDF;
	autoTable: typeof import("jspdf-autotable").autoTable;
};

type RGB = [number, number, number];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;
const CONTENT_BOTTOM = 265;
const BODY_FONT = "Inter";

const COLORS = {
	brown: [44, 24, 16],
	caramel: [139, 84, 43],
	cream: [249, 246, 242],
	muted: [105, 92, 84],
	line: [224, 216, 209],
	red: [174, 44, 44],
	white: [255, 255, 255],
} satisfies Record<string, RGB>;

function lineDetails(line: OrderLineView) {
	if (line.contents.length === 0) return "";
	return `${line.isCombo ? "Includes" : "Add-ons"}: ${line.contents.join(", ")}`;
}

// The total is drawn in jsPDF's built-in Helvetica, which has no ₹ glyph, so amounts print as "INR".
function formatMoney(cents: number) {
	return `INR ${rupees(cents).toLocaleString("en-IN", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}

	return btoa(binary);
}

function setFillColor(document: JsPdfDocument, color: RGB) {
	document.setFillColor(...color);
}

function setTextColor(document: JsPdfDocument, color: RGB) {
	document.setTextColor(...color);
}

function setDrawColor(document: JsPdfDocument, color: RGB) {
	document.setDrawColor(...color);
}

function registerInvoiceFont(document: JsPdfDocument, font: Uint8Array) {
	document.addFileToVFS("Inter-Regular.ttf", uint8ArrayToBase64(font));
	document.addFont("Inter-Regular.ttf", BODY_FONT, "normal");
}

function drawInvoiceHeader(document: JsPdfDocument, invoice: OrderView, logo: Uint8Array) {
	document.addImage(logo, "PNG", MARGIN, 10, 22, 22);

	setTextColor(document, COLORS.brown);
	document.setFont("helvetica", "bold");
	document.setFontSize(17);
	document.text(BRAND_NAME, MARGIN + 27, 19);
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(8.5);
	setTextColor(document, COLORS.muted);
	document.text("Made with care. Served with joy.", MARGIN + 27, 25);

	document.setFont("helvetica", "bold");
	document.setFontSize(18);
	setTextColor(document, COLORS.brown);
	document.text("ORDER INVOICE", PAGE_WIDTH - MARGIN, 18, { align: "right" });
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(9);
	setTextColor(document, COLORS.muted);
	document.text(invoice.orderLabel, PAGE_WIDTH - MARGIN, 25, { align: "right" });

	const statusColor = invoice.isCancelled ? COLORS.red : COLORS.caramel;
	setFillColor(document, statusColor);
	document.roundedRect(PAGE_WIDTH - MARGIN - 29, 28, 29, 7, 3.5, 3.5, "F");
	document.setFont("helvetica", "bold");
	document.setFontSize(7.5);
	setTextColor(document, COLORS.white);
	document.text(invoice.status.toUpperCase(), PAGE_WIDTH - MARGIN - 14.5, 32.7, { align: "center" });

	setDrawColor(document, COLORS.line);
	document.line(MARGIN, 39, PAGE_WIDTH - MARGIN, 39);
}

function drawOrderSummary(document: JsPdfDocument, invoice: OrderView) {
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(11);
	const customerLines: string[] = document.splitTextToSize(invoice.customerName, 78);
	const boxHeight = Math.max(25, 19 + (customerLines.length - 1) * 4.5);

	setFillColor(document, COLORS.cream);
	document.roundedRect(MARGIN, 44, 87, boxHeight, 2, 2, "F");
	document.roundedRect(107, 44, 87, boxHeight, 2, 2, "F");
	document.setFont("helvetica", "bold");
	document.setFontSize(7.5);
	setTextColor(document, COLORS.caramel);
	document.text("PREPARED FOR", MARGIN + 4, 50);
	document.text("ORDER DETAILS", 111, 50);

	document.setFont(BODY_FONT, "normal");
	document.setFontSize(11);
	setTextColor(document, COLORS.brown);
	document.text(customerLines, MARGIN + 4, 58);

	document.setFontSize(8.5);
	setTextColor(document, COLORS.muted);
	document.text("Placed", 111, 57);
	document.text(`${formatDate(invoice.createdAt)}, ${formatTime(invoice.createdAt)}`, PAGE_WIDTH - MARGIN - 4, 57, {
		align: "right",
	});
	document.text("Order number", 111, 64);
	document.text(invoice.orderLabel, PAGE_WIDTH - MARGIN - 4, 64, { align: "right" });

	return 44 + boxHeight;
}

function drawContinuationHeader(document: JsPdfDocument, invoice: OrderView) {
	setTextColor(document, COLORS.brown);
	document.setFont("helvetica", "bold");
	document.setFontSize(12);
	document.text("COCOA COMAA", MARGIN, 17);
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(8);
	setTextColor(document, COLORS.muted);
	document.text(`INVOICE ${invoice.orderLabel} - CONTINUED`, PAGE_WIDTH - MARGIN, 17, { align: "right" });
	setDrawColor(document, COLORS.line);
	document.line(MARGIN, 22, PAGE_WIDTH - MARGIN, 22);
}

function drawInvoiceTable(
	document: JsPdfDocument,
	invoice: OrderView,
	autoTable: PdfDependencies["autoTable"],
	startY: number,
) {
	let finalY = startY;

	autoTable(document, {
		startY,
		margin: { top: 29, right: MARGIN, bottom: PAGE_HEIGHT - CONTENT_BOTTOM, left: MARGIN },
		theme: "plain",
		showHead: "everyPage",
		rowPageBreak: "avoid",
		head: [["ITEM", "QTY", "RATE", "AMOUNT"]],
		body: invoice.lines.map((line) => [
			[line.name, lineDetails(line)].filter(Boolean).join("\n"),
			String(line.quantity),
			formatMoney(line.unitPriceCents),
			formatMoney(line.lineTotalCents),
		]),
		styles: {
			font: BODY_FONT,
			fontStyle: "normal",
			fontSize: 8.5,
			textColor: COLORS.brown,
			cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
			lineColor: COLORS.line,
			lineWidth: { bottom: 0.15 },
			overflow: "linebreak",
			valign: "middle",
		},
		headStyles: {
			font: "helvetica",
			fontStyle: "bold",
			fontSize: 8,
			fillColor: COLORS.brown,
			textColor: COLORS.white,
			lineWidth: 0,
			minCellHeight: 10,
			valign: "middle",
		},
		alternateRowStyles: { fillColor: COLORS.cream },
		columnStyles: {
			0: { cellWidth: 105 },
			1: { cellWidth: 18, halign: "center" },
			2: { cellWidth: 27, halign: "right" },
			3: { cellWidth: 28, halign: "right" },
		},
		willDrawPage: ({ pageNumber }) => {
			if (pageNumber > 1) {
				drawContinuationHeader(document, invoice);
			}
		},
		didDrawPage: ({ cursor }) => {
			if (cursor) finalY = cursor.y;
		},
	});

	return finalY;
}

function drawInvoiceTotals(document: JsPdfDocument, invoice: OrderView, tableEndY: number) {
	const totalsHeight = 31 + (invoice.deliveryCents > 0 ? 7 : 0) + (invoice.isCancelled ? 9 : 0);
	let y = tableEndY;

	if (y + totalsHeight > CONTENT_BOTTOM) {
		document.addPage();
		drawContinuationHeader(document, invoice);
		y = 29;
	}

	y += 7;
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(9);
	setTextColor(document, COLORS.muted);
	document.text("Subtotal", 147, y, { align: "right" });
	document.text(formatMoney(invoice.subtotalCents), PAGE_WIDTH - MARGIN, y, { align: "right" });

	if (invoice.deliveryCents > 0) {
		y += 7;
		document.text("Delivery", 147, y, { align: "right" });
		document.text(formatMoney(invoice.deliveryCents), PAGE_WIDTH - MARGIN, y, { align: "right" });
	}

	y += 5;
	setDrawColor(document, COLORS.caramel);
	document.line(128, y, PAGE_WIDTH - MARGIN, y);
	y += 8;
	document.setFont("helvetica", "bold");
	document.setFontSize(12);
	setTextColor(document, COLORS.brown);
	document.text("TOTAL", 147, y, { align: "right" });
	document.text(formatMoney(invoice.totalCents), PAGE_WIDTH - MARGIN, y, { align: "right" });

	if (invoice.isCancelled) {
		y += 9;
		document.setFont("helvetica", "bold");
		document.setFontSize(8);
		setTextColor(document, COLORS.red);
		document.text("This order was cancelled.", PAGE_WIDTH - MARGIN, y, { align: "right" });
	}
}

function drawFooter(document: JsPdfDocument, page: number, pageCount: number) {
	setDrawColor(document, COLORS.line);
	document.line(MARGIN, PAGE_HEIGHT - 19, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 19);
	document.setFont(BODY_FONT, "normal");
	document.setFontSize(8);
	setTextColor(document, COLORS.muted);
	document.text(`Thank you for choosing ${BRAND_NAME}.`, MARGIN, PAGE_HEIGHT - 12);
	document.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12, { align: "right" });
}

function renderOrderInvoicePdf(invoice: OrderView, assets: InvoiceAssets, dependencies: PdfDependencies) {
	const document = new dependencies.jsPDF({
		orientation: "portrait",
		unit: "mm",
		format: "a4",
		compress: true,
	});

	registerInvoiceFont(document, assets.font);
	document.setProperties({
		title: `${BRAND_NAME} invoice ${invoice.orderLabel}`,
		subject: `Order invoice for ${invoice.customerName}`,
		author: BRAND_NAME,
		creator: `${BRAND_NAME} Store`,
	});

	drawInvoiceHeader(document, invoice, assets.logo);
	const summaryEndY = drawOrderSummary(document, invoice);
	const tableEndY = drawInvoiceTable(document, invoice, dependencies.autoTable, summaryEndY + 7);
	drawInvoiceTotals(document, invoice, tableEndY);

	const pageCount = document.getNumberOfPages();
	for (let page = 1; page <= pageCount; page += 1) {
		document.setPage(page);
		drawFooter(document, page, pageCount);
	}

	return document;
}

async function loadPdfDependencies(): Promise<PdfDependencies> {
	const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
	return { jsPDF, autoTable };
}

async function fetchAsset(path: string) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Unable to load invoice asset: ${path}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

/** The order's invoice as a PDF document. Refuses an order whose total disagrees with its lines and delivery. */
export async function createOrderInvoicePdf(order: OrderView, assets: InvoiceAssets) {
	if (order.subtotalCents + order.deliveryCents !== order.totalCents) {
		throw new Error(`Order ${order.orderLabel} totals do not match its line items`);
	}
	return renderOrderInvoicePdf(order, assets, await loadPdfDependencies());
}

export async function downloadOrderInvoice(order: OrderView) {
	const [font, logo] = await Promise.all([fetchAsset("/Inter-Regular.ttf"), fetchAsset("/logo.png")]);
	const document = await createOrderInvoicePdf(order, { font, logo });
	document.save(`cocoa-comaa-invoice-${order.id}.pdf`);
}
