import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/app/theme-color";
import { BRAND_NAME } from "@/components/ui/brand";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: `${BRAND_NAME} - Store`,
		short_name: BRAND_NAME,
		description: `${BRAND_NAME} - Store`,
		start_url: "/?from=pwa",
		display: "standalone",
		background_color: THEME_COLOR,
		theme_color: THEME_COLOR,
		orientation: "natural",
		categories: ["food", "dessert"],
		lang: "en",
		scope: "/",
		id: "com.cocoacomaa.store",
		icons: [
			{
				src: "/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
			},
			{
				src: "/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
