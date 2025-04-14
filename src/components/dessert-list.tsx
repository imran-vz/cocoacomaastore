"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@/components/ui/card";
import type { Dessert } from "@/lib/types";

interface DessertListProps {
	desserts: Dessert[];
	addToCart: (dessert: Dessert) => void;
}

export function DessertList({ desserts, addToCart }: DessertListProps) {
	return (
		<div className="flex flex-col gap-3">
			{desserts.map((dessert) => (
				<Card key={dessert.id} className="w-full shadow-none py-4 gap-2">
					<CardHeader>
						<div className="flex justify-between items-center">
							<h3 className="font-semibold text-base min-w-32 max-w-32 capitalize">
								{dessert.name}
							</h3>
							<p className="font-bold text-base">{dessert.price.toFixed(2)}</p>
							<Button onClick={() => addToCart(dessert)} size="sm">
								Add to Cart
							</Button>
						</div>
					</CardHeader>
				</Card>
			))}
		</div>
	);
}
