import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { DBOrder } from "./orders-page";

interface OrderModalProps {
	order: DBOrder;
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
	console.log(order.status);
	return (
		<Dialog open={true} onOpenChange={onClose}>
			<DialogContent className="-mt-20">
				<DialogHeader className="text-left">
					<DialogTitle>Order Details</DialogTitle>
					<DialogDescription asChild>
						<div className="space-y-1">
							<p className="mt-1 text-sm text-gray-500">
								<span className="font-bold">Customer:</span>{" "}
								{order.customerName}
							</p>
							<p className="mt-1 text-sm text-gray-500">
								<span className="font-bold">Order:</span> #{order.id}
							</p>
							<p className="mt-1 text-sm text-gray-500">
								<span className="font-bold">Time:</span>{" "}
								{order.createdAt.toLocaleTimeString("en-IN", {
									hour: "2-digit",
									minute: "2-digit",
									hour12: true,
								})}
							</p>
							<p className="mt-1 text-sm text-gray-500">
								<span className="font-bold">Date:</span>{" "}
								{order.createdAt.toLocaleDateString("en-IN", {
									year: "numeric",
									month: "short",
									day: "numeric",
								})}
							</p>
						</div>
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<table className="w-full">
						<thead>
							<tr className="border-b">
								<th className="text-left py-2">Items</th>
								<th className="text-right py-2">Quantity</th>
							</tr>
						</thead>
						<tbody>
							{order.orderItems.map((item) => (
								<tr key={item.id} className="border-b">
									<td className="py-2">{item.dessert.name}</td>
									<td className="text-right py-2">{item.quantity}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<DialogFooter>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Close
						</Button>
						<Button
							onClick={done}
							disabled={isLoading || order.status === "completed"}
						>
							{isLoading ? "Loading..." : "Done"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
