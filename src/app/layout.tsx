import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/navbar";

import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Cocoa Comaa",
	description: "Cocoa Comaa",
	icons: {
		icon: "/favicon.svg",
	},
	robots: {
		index: false,
		follow: false,
		noimageindex: true,
		noarchive: true,
		nosnippet: true,
		googleBot: {
			index: false,
			follow: false,
			noimageindex: true,
			noarchive: true,
			nosnippet: true,
		},
	},
	appleWebApp: {
		capable: true,
		title: "Cocoa Comaa",
		statusBarStyle: "black-translucent",
		startupImage: "/icon-512x512.png",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	minimumScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: "#000000",
	colorScheme: "light",
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
				<Analytics />
				<Navbar />
				{children}
				<Toaster
					position="top-center"
					richColors
					icons={{
						success: "👍",
						error: "🚫",
						info: "💡",
						warning: "⚠️",
						loading: "🔄",
					}}
					mobileOffset={50}
				/>
			</body>
		</html>
	);
}
