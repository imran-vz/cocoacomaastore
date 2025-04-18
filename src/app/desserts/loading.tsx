import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DessertsLoading() {
	return (
		<main className="min-h-screen p-3 pb-6 max-w-md mx-auto">
			<div className="flex flex-col gap-4">
				<div className="flex justify-between items-center">
					<h2 className="text-2xl font-bold">Desserts</h2>
					<Button type="button">Add Dessert</Button>
				</div>

				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		</main>
	);
}
