import { Analytics } from "@vercel/analytics/react";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito_Sans } from "next/font/google";

import Navbar from "@/components/navbar";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ServiceWorkerProvider } from "@/components/service-worker-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import "./globals.css";

const nunitoSans = Nunito_Sans({
	variable: "--font-nunito-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Cocoa Comaa",
	description: "Cocoa Comaa",
	icons: {
		icon: "/icon-192x192.png",
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
	themeColor: "#502922",
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
				className={cn(
					nunitoSans.variable,
					geistMono.variable,
					"antialiased bg-[url(/bg-grid.svg)]",
				)}
			>
				<ServiceWorkerProvider>
					<OfflineIndicator />
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
				</ServiceWorkerProvider>
			</body>
		</html>
	);
}
