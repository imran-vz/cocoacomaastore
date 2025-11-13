declare module "pdfkit/js/pdfkit.standalone" {
	import PDFDocument from "pdfkit";
	export default PDFDocument;
}

declare module "blob-stream" {
	function blobStream(): NodeJS.WritableStream & {
		toBlob(type?: string): Blob;
		on(event: string, callback: () => void): void;
	};
	export default blobStream;
}
