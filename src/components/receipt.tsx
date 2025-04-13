"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CartItem } from "@/lib/types";
import { Printer } from "lucide-react";
import { useRef } from "react";

interface ReceiptProps {
	cart: CartItem[];
	total: number;
	clearCart: () => void;
}

export function Receipt({ cart, total, clearCart }: ReceiptProps) {
	const receiptRef = useRef<HTMLDivElement>(null);

	const handlePrint = () => {
		const content = receiptRef.current;
		if (!content) return;

		const printWindow = window.open("", "_blank");
		if (!printWindow) return;

		const printDocument = printWindow.document;
		printDocument.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            /* Page setup for printing */
            @page {
              size: ISO A6;
              margin: 0;
            }

            @media print {
              html, body {
                height:100%; 
                margin: 0 !important; 
                padding: 0 !important;
                overflow: hidden;
              }
            }

            /* Base styles */
            body {
              font-family: 'Courier New', monospace;
              padding: 0;
              margin: 0;
              line-height: 1.5;
              color: #000;
              width: 100%;
              height:100%;
            }

            /* Tailwind reset */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            /* Tailwind-like utility classes */
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .text-base { font-size: 1rem; }
            .text-lg { font-size: 1.125rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-4 { margin-top: 1rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-3 { margin-bottom: 0.75rem; }
            .mb-4 { margin-bottom: 1rem; }
            .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
            .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
            .p-2 { padding: 0.5rem; }
            .p-3 { padding: 0.75rem; }
            .p-4 { padding: 1rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
            .w-full { width: 100%; }
            .w-8 { width: 2rem; }
            .w-16 { width: 4rem; }
            .max-w-xs { max-width: 20rem; }
            .border { border: 1px solid #e2e8f0; }
            .border-dashed { border-style: dashed; }
            .border-t { border: 0px dashed #e2e8f0; border-top-width: 1px;  }
            .border-b { border-bottom-width: 1px; }
            .border-gray-300 { border-color: #d1d5db; }
            .rounded-md { border-radius: 0.375rem; }
            .bg-white { background-color: #ffffff; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
            .truncate {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .gap-4 { gap: 1rem; }
            .text-left { text-align: left; }
            .h-px { height: 1px; }
            .bg-slate-300 { background-color: #d1d5db; }

            /* Receipt specific styles */
            .receipt-container {
              width: 100%;
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .receipt-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .receipt-total {
              margin-top: 12px;
              font-weight: bold;
              border-top: 1px dashed #000;
              padding-top: 8px;
            }
            .receipt-footer {
              text-align: center;
              margin-top: 30px;
              font-size: 12px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 15px 0;
              width: 100%;
            }

            /* Print specific styles */
            @media print {
              html, body {
                width: 148mm; /* A5 width */
                height: 210mm; /* A5 height */
                transform: scale(1.2);
                transform-origin: top left;
              }

              .receipt-container {
                width: 100%;
                padding: 10mm;
                box-sizing: border-box;
              }

              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="bg-white p-3 font-mono text-xs border border-dashed border-gray-300 rounded-md">
              ${content.innerHTML}
            </div>
          </div>

          <script>
            // Auto-print when loaded
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);

		printDocument.close();
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

				<div className="flex justify-between font-bold text-base">
					<span>Total:</span>
					<span>₹{total.toFixed(2)}</span>
				</div>
			</div>

			<div className="flex gap-2 mt-4">
				<Button onClick={handlePrint} className="flex-1">
					<Printer className="mr-2 h-4 w-4" />
					Print Receipt
				</Button>
				<Button onClick={handleNewOrder} variant="outline" className="flex-1">
					New Order
				</Button>
			</div>
		</div>
	);
}
