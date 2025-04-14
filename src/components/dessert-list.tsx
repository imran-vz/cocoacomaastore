"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Dessert } from "@/lib/types";

interface DessertListProps {
	desserts: Dessert[];
	addToCart: (dessert: Dessert) => void;
}

export function DessertList({ desserts, addToCart }: DessertListProps) {
	return (
		<div className="flex flex-col gap-2">
			{desserts.map((dessert) => (
				<Card key={dessert.id} className="w-full shadow-none py-3 gap-2">
					<CardContent className="px-4">
						<div className="flex justify-between items-center">
							<div className="flex-1">
								<h4 className="font-bold text-base capitalize">
									{dessert.name}
								</h4>
								<p className="text-xs text-muted-foreground">
									{dessert.price.toFixed(2)}
								</p>
							</div>
							<Button onClick={() => addToCart(dessert)} size="sm">
								Add to Cart
							</Button>
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
