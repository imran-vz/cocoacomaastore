import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatINR } from "@/lib/format";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
