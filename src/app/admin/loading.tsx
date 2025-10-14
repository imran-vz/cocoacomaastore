import { Spinner } from "@/components/ui/spinner";

export default function AdminLoading() {
	return (
		<div className="flex justify-center items-center min-h-[calc(50svh)]">
			<Spinner className="size-10" />
		</div>
	);
}
