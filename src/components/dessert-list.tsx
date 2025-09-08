"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Dessert } from "@/lib/types";

interface DessertListProps {
	desserts: Dessert[];
	addToCart: (dessert: Dessert) => void;
}

export function DessertList({ desserts, addToCart }: DessertListProps) {
	return (
		<div>
			<h2 className="text-2xl font-bold mb-6">Our Desserts</h2>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
				{desserts.map((dessert) => (
					<Button
						asChild
						key={dessert.id}
						variant={"outline"}
						onClick={() => addToCart(dessert)}
						className="py-2 h-auto items-start hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
					>
						<Card className="w-full shadow-none py-3 gap-2 cursor-pointer">
							<CardContent className="px-3 py-0 w-full">
								<div className="flex flex-col items-start text-left">
									<h4 className="font-medium text-sm text-primary capitalize line-clamp-2 mb-1 max-w-[90%] truncate">
										{dessert.name}
									</h4>
									{dessert.description && (
										<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
											{dessert.description}
										</p>
									)}
									<p className="text-sm font-semibold text-green-700">
										₹{dessert.price.toFixed(2)}
									</p>
								</div>
							</CardContent>
						</Card>
					</Button>
				))}
			</div>
			{desserts.length === 0 && (
				<div className="text-center py-12">
					<div className="text-muted-foreground">
						No desserts available at the moment.
					</div>
				</div>
			)}
		</div>
	);
}
