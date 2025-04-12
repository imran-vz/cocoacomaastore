"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import type { Dessert } from "@/lib/types";

interface ProductListProps {
	desserts: Dessert[];
	addToCart: (product: Dessert) => void;
}

export function ProductList({ desserts, addToCart }: ProductListProps) {
	return (
		<div className="flex flex-col gap-3">
			{desserts.map((dessert) => (
				<Card key={dessert.id} className="w-full py-4 gap-2">
					<CardHeader>
						<div className="flex justify-between items-start">
							<h3 className="font-semibold text-base">{dessert.name}</h3>
							<p className="font-bold text-base">{dessert.price.toFixed(2)}</p>
						</div>
					</CardHeader>

					{dessert.description && (
						<CardContent>
							<p className="text-sm text-muted-foreground">
								{dessert.description}
							</p>
						</CardContent>
					)}

					<CardFooter>
						<div className="flex justify-end w-full">
							<Button onClick={() => addToCart(dessert)} size="sm">
								Add to Cart
							</Button>
						</div>
					</CardFooter>
				</Card>
			))}
		</div>
	);
}
