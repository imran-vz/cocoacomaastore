import { MenuIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

export default function Navbar() {
	return (
		<div className="flex justify-between px-4 py-3 shadow items-center">
			<Link href="/">
				<h1 className="text-xl font-bold text-center">Cocoa Comaa Shop</h1>
			</Link>
			<Sheet>
				<SheetTrigger asChild>
					<Button variant="outline">
						<MenuIcon className="h-4 w-4" />
					</Button>
				</SheetTrigger>
				<SheetContent className="w-[200px] sm:w-[540px]">
					<SheetHeader>
						<SheetTitle>Navbar</SheetTitle>
						<SheetDescription asChild>
							<ul
								aria-label="navbar"
								className="flex flex-col gap-8 w-full h-96 justify-center items-center"
							>
								<li>
									<SheetClose asChild>
										<Link
											className="text-2xl font-medium text-slate-900 underline"
											href="/"
										>
											Home
										</Link>
									</SheetClose>
								</li>
								<li>
									<SheetClose asChild>
										<Link
											className="text-2xl font-medium text-slate-900 underline "
											href="/desserts"
										>
											Desserts
										</Link>
									</SheetClose>
								</li>
								<li>
									<SheetClose asChild>
										<Link
											className="text-2xl font-medium text-slate-900 underline "
											href="/orders"
										>
											Orders
										</Link>
									</SheetClose>
								</li>
							</ul>
						</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>
		</div>
	);
}
