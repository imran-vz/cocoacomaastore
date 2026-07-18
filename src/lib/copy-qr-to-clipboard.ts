export async function copyQrSvgToClipboard(svgElement: SVGSVGElement): Promise<void> {
	const svgData = new XMLSerializer().serializeToString(svgElement);
	const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(svgBlob);
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	const image = new Image(400, 400);

	try {
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Could not render the QR code"));
			image.src = url;
		});
		const padding = 48;
		canvas.width = image.width + padding * 2;
		canvas.height = image.height + padding * 2;
		if (!context) throw new Error("Could not prepare the QR code");
		context.fillStyle = "white";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(image, padding, padding);
		const response = await fetch(canvas.toDataURL("image/png"));
		const blob = await response.blob();
		await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
	} finally {
		URL.revokeObjectURL(url);
	}
}
