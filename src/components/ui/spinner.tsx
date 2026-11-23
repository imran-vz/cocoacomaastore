import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The one loading indicator. Decorative: the text beside it says what is loading. */
function Spinner({ className }: { className?: string }) {
	return <Loader2Icon aria-hidden="true" className={cn("size-4 animate-spin motion-reduce:animate-none", className)} />;
}

export { Spinner };
