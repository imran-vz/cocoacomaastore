import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Cocoa Comaa - Store",
		short_name: "Cocoa Comaa",
		description: "Cocoa Comaa - Store",
		start_url: "/?from=pwa",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#502922",
		orientation: "any",
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
		],
	};
}
