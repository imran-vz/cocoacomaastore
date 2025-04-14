import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Cocoa Comaa",
		short_name: "Cocoa Comaa",
		description: "Cocoa Comaa",
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#502922",
		orientation: "portrait",
		categories: ["food", "dessert"],
		lang: "en",
		scope: "/",
		display_override: ["fullscreen", "standalone"],
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
