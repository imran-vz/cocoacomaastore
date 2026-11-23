"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import type { FeedbackStatus } from "@/components/ui/feedback";
import { tweenFast } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Flashes a check (success) or a cross (error) over its positioned parent, e.g. a `Switch`. */
export function FeedbackCheck({ status, className }: { status: FeedbackStatus; className?: string }) {
	const visible = status === "success" || status === "error";
	return (
		<motion.span
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit]",
				status === "error" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground",
				className,
			)}
			initial={false}
			animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.96 }}
			transition={tweenFast}
		>
			{status === "error" ? <X className="size-3.5" /> : <Check className="size-3.5" />}
		</motion.span>
	);
}
