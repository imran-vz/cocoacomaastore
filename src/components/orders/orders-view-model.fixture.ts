import type { SerializedOrderDetails } from "@/lib/order-lifecycle";

export function makeSerializedOrder(overrides: Partial<SerializedOrderDetails> = {}): SerializedOrderDetails {
	return {
		id: 1,
		customerName: "",
		createdAt: "2026-07-17T13:31:00.000Z",
		deliveryCost: "0.00",
		total: "280.00",
		status: "completed",
		orderItems: [
			{
				id: 11,
				dessert: { id: 2, name: "Ragi Fudge Brownie" },
				quantity: 2,
				unitPrice: "90.00",
				comboId: null,
				comboName: null,
				modifiers: [
					{
						id: 21,
						dessert: { id: 3, name: "Ice Cream" },
						quantity: 1,
					},
				],
			},
		],
		...overrides,
	};
}
