import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Order } from "@/lib/types";

interface OrderModalProps {
	order: Order;
	onClose: () => void;
	done: () => void;
	isLoading: boolean;
}

export default function OrderModal({
	order,
	onClose,
	done,
	isLoading,
}: OrderModalProps) {
	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogHeader>
				<DialogTitle>Order Details</DialogTitle>
			</DialogHeader>
			<DialogContent>
				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-medium leading-6 text-gray-900">
							Customer Name
						</h3>
						<p className="mt-1 text-sm text-gray-500">{order.customerName}</p>
					</div>
				</div>

				<div className="space-y-4">
					<table className="w-full">
						<thead>
							<tr className="border-b">
								<th className="text-left py-2">Item</th>
								<th className="text-right py-2">Quantity</th>
							</tr>
						</thead>
						<tbody>
							{order.items.map((item) => (
								<tr key={item.id} className="border-b">
									<td className="py-2">{item.name}</td>
									<td className="text-right py-2">{item.quantity}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
					<Button onClick={done} disabled={isLoading}>
						{isLoading ? "Loading..." : "Done"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
