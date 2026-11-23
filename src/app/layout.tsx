import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { THEME_COLOR } from "@/app/theme-color";
import { Providers } from "@/components/providers";
import { BRAND_NAME } from "@/components/ui/brand";
import { cn } from "@/lib/utils";

import "./globals.css";

const nunitoSans = Nunito_Sans({
	variable: "--font-nunito-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: BRAND_NAME,
	description: BRAND_NAME,
	icons: {
		icon: "/favicon.png",
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
		title: BRAND_NAME,
		// The app bar is light, so the iOS status bar uses dark text on its own opaque strip.
		statusBarStyle: "default",
		startupImage: "/icon-512x512.png",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	minimumScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
	// The page background, so the browser/status bar merges with the app bar.
	themeColor: THEME_COLOR,
	colorScheme: "light",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" data-scroll-behavior="smooth">
			<body className={cn(nunitoSans.variable, geistMono.variable, "antialiased select-none")}>
				<NuqsAdapter>
					<Providers>{children}</Providers>
				</NuqsAdapter>
			</body>
		</html>
	);
}
