import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Database } from "lucide-react";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Cocoa Comaa Shop",
	description: "Cocoa Comaa Shop",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<div className="flex justify-between px-4 py-3 shadow items-center">
					<Link href="/">
						<h1 className="text-xl font-bold text-center">Cocoa Comaa Shop</h1>
					</Link>
					<Button asChild variant="outline">
						<Link href="/admin">
							<Database className="h-4 w-4" />
						</Link>
					</Button>
				</div>
				{children}
				<Toaster />
			</body>
		</html>
	);
}
