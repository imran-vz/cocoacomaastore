const QUIET_ZONE_PX = 48;

/** Copies a rendered QR code to the clipboard as a PNG on white, with a quiet zone so scanners pick it up. */
export async function copyQrSvgToClipboard(svgElement: SVGSVGElement): Promise<void> {
	const size = svgElement.width.baseVal.value;
	const svgData = new XMLSerializer().serializeToString(svgElement);
	const url = URL.createObjectURL(new Blob([svgData], { type: "image/svg+xml;charset=utf-8" }));
	const image = new Image(size, size);

	try {
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Could not render the QR code"));
			image.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = size + QUIET_ZONE_PX * 2;
		canvas.height = size + QUIET_ZONE_PX * 2;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Could not prepare the QR code");
		context.fillStyle = "white";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(image, QUIET_ZONE_PX, QUIET_ZONE_PX);
		const png = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the QR code"))), "image/png"),
		);
		await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
	} finally {
		URL.revokeObjectURL(url);
	}
}
