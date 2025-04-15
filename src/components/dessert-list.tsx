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
		<div className="grid grid-cols-2">
			{desserts.map((dessert) => (
				<Button asChild key={dessert.id} onClick={()=>addToCart(dessert)}>
					<Card  className="w-full shadow-none py-3 gap-2">
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
							</div>
						</CardContent>
					</Card>
				</Button>
			))}
		</div>
	);
}
