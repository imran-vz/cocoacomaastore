/**
 * Input sanitization utilities to prevent XSS and injection attacks
 */

/**
 * Remove HTML tags and dangerous characters from text input
 */
function sanitizeText(input: string): string {
	return (
		input
			// Remove HTML tags
			.replace(/<[^>]*>/g, "")
			// Remove script-related content
			.replace(/javascript:/gi, "")
			.replace(/on\w+\s*=/gi, "")
			// Remove null bytes
			.split("\u0000")
			.join("")
			// Trim whitespace
			.trim()
	);
}

/**
 * Sanitize customer name - allow only letters, numbers, spaces, and common punctuation
 */
export function sanitizeCustomerName(name: string): string {
	return sanitizeText(name)
		.replace(/[^\p{L}\p{N}\s.,'-]/gu, "")
		.slice(0, 255);
}

/**
 * Sanitize general text fields (descriptions, labels, etc.)
 */
export function sanitizeDescription(text: string): string {
	return sanitizeText(text).slice(0, 255);
}

/**
 * Sanitize UPI ID - allow only valid UPI characters
 */
export function sanitizeUpiId(upiId: string): string {
	return upiId
		.trim()
		.toLowerCase()
		.replace(/[^\w.-@]/g, "")
		.slice(0, 255);
}

/**
 * Sanitize email - basic cleaning
 */
export function sanitizeEmail(email: string): string {
	return email.trim().toLowerCase().slice(0, 255);
}
