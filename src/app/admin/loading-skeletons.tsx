import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const chartBars = [
	{ id: "jan", height: 44 },
	{ id: "feb", height: 66 },
	{ id: "mar", height: 52 },
	{ id: "apr", height: 82 },
	{ id: "may", height: 60 },
	{ id: "jun", height: 74 },
	{ id: "jul", height: 48 },
	{ id: "aug", height: 70 },
	{ id: "sep", height: 56 },
	{ id: "oct", height: 86 },
	{ id: "nov", height: 62 },
	{ id: "dec", height: 76 },
];

const productSlots = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const dashboardStatSlots = ["orders", "revenue", "items", "average"];
const listSlots = ["first", "second", "third", "fourth", "fifth"];
const dessertControlSlots = ["top", "up", "down", "bottom"];
const comboSlots = ["primary", "secondary", "tertiary"];
const orderStatSlots = ["orders", "items", "revenue"];
const orderCardSlots = ["latest", "second", "third", "fourth"];
const analyticsStatSlots = ["total-revenue", "total-orders", "month-revenue"];
const passwordFieldSlots = ["current", "new", "confirm"];

function rowSlots(count: number) {
	return Array.from({ length: count }, (_, index) => `row-${index + 1}`);
}

function PageHeaderSkeleton({
	titleWidth = "w-48",
	subtitleWidth = "w-72",
	actionWidth,
}: {
	titleWidth?: string;
	subtitleWidth?: string;
	actionWidth?: string;
}) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-2">
				<Skeleton className={`h-8 ${titleWidth}`} />
				{subtitleWidth && <Skeleton className={`h-4 ${subtitleWidth} max-w-full`} />}
			</div>
			{actionWidth && <Skeleton className={`h-9 ${actionWidth}`} />}
		</div>
	);
}

function StatCardSkeleton() {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="size-4 rounded" />
			</CardHeader>
			<CardContent className="space-y-2">
				<Skeleton className="h-8 w-24" />
				<Skeleton className="h-3 w-32" />
			</CardContent>
		</Card>
	);
}

function ChartSkeleton({ height = "h-80" }: { height?: string }) {
	return (
		<div className={`${height} w-full rounded-md border border-dashed p-4`}>
			<div className="flex h-full items-end gap-3">
				{chartBars.map((bar) => (
					<Skeleton key={bar.id} className="flex-1 rounded-t-sm" style={{ height: `${bar.height}%` }} />
				))}
			</div>
		</div>
	);
}

function AdminTableSkeleton({
	headers,
	rows = 5,
	actionColumn = true,
}: {
	headers: string[];
	rows?: number;
	actionColumn?: boolean;
}) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						{headers.map((header) => (
							<TableHead key={header}>{header}</TableHead>
						))}
						{actionColumn && <TableHead className="text-right">Actions</TableHead>}
					</TableRow>
				</TableHeader>
				<TableBody>
					{rowSlots(rows).map((rowId) => (
						<TableRow key={rowId}>
							{headers.map((header, columnIndex) => (
								<TableCell key={`${rowId}-${header}`}>
									<Skeleton
										className={
											columnIndex === 0 ? "h-5 w-32" : columnIndex === headers.length - 1 ? "h-5 w-20" : "h-5 w-28"
										}
									/>
								</TableCell>
							))}
							{actionColumn && (
								<TableCell>
									<div className="flex justify-end gap-2">
										<Skeleton className="size-8 rounded-md" />
										<Skeleton className="size-8 rounded-md" />
									</div>
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function AdminHomeSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<div className="grid gap-4 md:grid-cols-2 md:items-start xl:grid-cols-3 md:gap-6">
				<div className="space-y-6 xl:col-span-2">
					<div className="space-y-3">
						<Skeleton className="h-9 w-full max-w-md" />
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
							{productSlots.map((slot) => (
								<Card key={slot} className="min-h-34">
									<CardContent className="space-y-3 p-3">
										<Skeleton className="h-5 w-3/4" />
										<Skeleton className="h-4 w-1/2" />
										<div className="flex items-center justify-between pt-4">
											<Skeleton className="h-6 w-14" />
											<Skeleton className="size-8 rounded-md" />
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</div>
				<div className="space-y-4 md:sticky md:top-20">
					<Card className="border-2">
						<CardContent className="space-y-4 p-4">
							<div className="grid gap-3 sm:grid-cols-2">
								<Skeleton className="h-14" />
								<Skeleton className="h-14" />
							</div>
							<Skeleton className="h-75 rounded-lg" />
						</CardContent>
					</Card>
					<Card className="border-2">
						<CardContent className="space-y-4 p-4">
							<Skeleton className="h-6 w-36" />
							<Skeleton className="h-24 rounded-lg" />
						</CardContent>
					</Card>
				</div>
			</div>
		</main>
	);
}

export function DashboardSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	const content = (
		<div className="space-y-4">
			<PageHeaderSkeleton actionWidth="w-36" />
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{dashboardStatSlots.map((slot) => (
					<StatCardSkeleton key={slot} />
				))}
			</div>
			<Card className="col-span-4">
				<CardHeader className="space-y-2">
					<Skeleton className="h-6 w-44" />
					<Skeleton className="h-4 w-32" />
				</CardHeader>
				<CardContent>
					<ChartSkeleton height="h-75" />
				</CardContent>
			</Card>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{["Stock Levels", "Audit Log"].map((title) => (
					<Card key={title} className="col-span-2">
						<CardHeader className="space-y-2">
							<Skeleton className="h-6 w-36" />
							<Skeleton className="h-4 w-44" />
						</CardHeader>
						<CardContent className="space-y-3">
							{listSlots.map((slot) => (
								<Skeleton key={`${title}-${slot}`} className="h-14 rounded-lg" />
							))}
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);

	if (!includeMain) return content;

	return <main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-6xl mx-auto">{content}</main>;
}

export function DessertsSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6">
			<div className="mx-auto max-w-4xl space-y-4">
				<PageHeaderSkeleton titleWidth="w-56" subtitleWidth="w-80" actionWidth="w-72" />
				<Skeleton className="h-10 w-full sm:max-w-xs" />
				<DessertTableSectionSkeleton titleWidth="w-28" rows={6} />
				<DessertTableSectionSkeleton titleWidth="w-24" rows={3} muted />
			</div>
		</main>
	);
}

function DessertTableSectionSkeleton({
	titleWidth,
	rows,
	muted = false,
}: {
	titleWidth: string;
	rows: number;
	muted?: boolean;
}) {
	return (
		<div className={muted ? "opacity-80" : undefined}>
			<Skeleton className={`mb-2 h-5 ${titleWidth}`} />
			<div className="overflow-hidden rounded-lg border bg-white shadow-sm">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/50">
							<TableHead className="w-16">#</TableHead>
							<TableHead>Dessert</TableHead>
							<TableHead className="w-24 text-center">Stock</TableHead>
							<TableHead className="w-16 text-center">Edit</TableHead>
							<TableHead className="w-20 text-center">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rowSlots(rows).map((rowId) => (
							<TableRow key={`dessert-${rowId}`}>
								<TableCell>
									<div className="flex gap-0.5">
										{dessertControlSlots.map((slot) => (
											<Skeleton key={`dessert-control-${slot}`} className="size-7 rounded-md" />
										))}
									</div>
								</TableCell>
								<TableCell className="space-y-1">
									<Skeleton className="h-5 w-40" />
									<Skeleton className="h-3 w-16" />
								</TableCell>
								<TableCell>
									<Skeleton className="mx-auto h-8 w-20" />
								</TableCell>
								<TableCell>
									<Skeleton className="mx-auto size-7 rounded-md" />
								</TableCell>
								<TableCell>
									<Skeleton className="mx-auto h-7 w-12 rounded-md" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

export function CombosSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-3 pb-6 max-w-7xl mx-auto">
			<div className="@container/combos">
				<div className="space-y-4 p-2 @sm/combos:p-4 @md/combos:space-y-6 @md/combos:p-0">
					<PageHeaderSkeleton titleWidth="w-28" subtitleWidth="" actionWidth="w-28" />
					<Skeleton className="h-10 w-full max-w-sm" />
					<ComboSectionSkeleton titleWidth="w-40" />
					<ComboSectionSkeleton titleWidth="w-44" muted />
				</div>
			</div>
		</main>
	);
}

function ComboSectionSkeleton({ titleWidth, muted = false }: { titleWidth: string; muted?: boolean }) {
	return (
		<div className={muted ? "opacity-60" : undefined}>
			<Skeleton className={`mb-4 h-6 ${titleWidth}`} />
			<div className="grid grid-cols-1 gap-4 @sm/combos:grid-cols-2 @lg/combos:grid-cols-3">
				{comboSlots.map((slot) => (
					<Card key={`combo-card-${titleWidth}-${slot}`}>
						<CardHeader className="pb-2">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2">
									<Skeleton className="size-5 rounded" />
									<Skeleton className="h-5 w-32" />
								</div>
								<div className="flex gap-2">
									<Skeleton className="size-8 rounded-md" />
									<Skeleton className="h-6 w-10 rounded-full" />
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-2">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-3 w-52" />
							<Skeleton className="h-5 w-16" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

export function OrdersSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	const content = (
		<div className="space-y-4">
			<PageHeaderSkeleton titleWidth="w-24" subtitleWidth="w-44" actionWidth="w-36" />
			<div className="grid grid-cols-3 gap-3">
				{orderStatSlots.map((slot) => (
					<Card key={slot} className="p-3">
						<div className="flex flex-col items-center gap-2 text-center">
							<Skeleton className="size-4 rounded" />
							<Skeleton className="h-7 w-12" />
							<Skeleton className="h-3 w-14" />
						</div>
					</Card>
				))}
			</div>
			<div className="space-y-3">
				{orderCardSlots.map((slot) => (
					<Card key={slot} className="border-l-4 border-l-transparent">
						<div className="p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 flex-1 space-y-2">
									<div className="flex items-center gap-2">
										<Skeleton className="h-5 w-14 rounded-full" />
										<Skeleton className="h-4 w-20" />
									</div>
									<Skeleton className="h-6 w-44" />
									<Skeleton className="h-4 w-72 max-w-full" />
								</div>
								<div className="flex flex-col items-end gap-2">
									<Skeleton className="h-6 w-16" />
									<Skeleton className="h-5 w-14 rounded-full" />
								</div>
							</div>
						</div>
					</Card>
				))}
			</div>
		</div>
	);

	if (!includeMain) return content;

	return <main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">{content}</main>;
}

export function AnalyticsSkeleton({ includeMain = true }: { includeMain?: boolean } = {}) {
	const content = (
		<div className="space-y-6">
			<PageHeaderSkeleton titleWidth="w-40" subtitleWidth="w-96" />
			<div className="grid gap-4 md:grid-cols-3">
				{analyticsStatSlots.map((slot) => (
					<StatCardSkeleton key={slot} />
				))}
			</div>
			<Card>
				<CardHeader className="space-y-2">
					<Skeleton className="h-6 w-56" />
					<Skeleton className="h-4 w-48" />
				</CardHeader>
				<CardContent>
					<ChartSkeleton />
				</CardContent>
			</Card>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-2">
								<Skeleton className="h-6 w-48" />
								<Skeleton className="h-4 w-64" />
							</div>
							<Skeleton className="h-10 w-40" />
						</div>
					</CardHeader>
					<CardContent>
						<AdminTableSkeleton headers={["Dessert", "Qty", "Revenue"]} rows={6} actionColumn={false} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="space-y-2">
						<Skeleton className="h-6 w-44" />
						<Skeleton className="h-4 w-44" />
					</CardHeader>
					<CardContent>
						<div className="flex h-80 items-center justify-center">
							<Skeleton className="size-52 rounded-full" />
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);

	if (!includeMain) return content;

	return <main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-7xl mx-auto">{content}</main>;
}

export function UpiAccountsSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<div className="space-y-4">
				<PageHeaderSkeleton titleWidth="w-48" subtitleWidth="w-64" actionWidth="w-40" />
				<AdminTableSkeleton headers={["Label", "UPI ID", "Status", "Created At"]} />
			</div>
		</main>
	);
}

export function ManagersSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<div className="space-y-4">
				<PageHeaderSkeleton titleWidth="w-36" subtitleWidth="w-72" actionWidth="w-32" />
				<AdminTableSkeleton headers={["Name", "Email", "Role", "Created At"]} rows={5} actionColumn />
			</div>
		</main>
	);
}

export function SettingsSkeleton() {
	return (
		<main className="min-h-[calc(100vh-52px)] p-4 pb-8 w-full max-w-4xl mx-auto">
			<div className="mb-6 space-y-2">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-80 max-w-full" />
			</div>
			<div className="max-w-lg space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-3">
							<Skeleton className="size-5 rounded" />
							<div className="space-y-2">
								<Skeleton className="h-5 w-24" />
								<Skeleton className="h-4 w-40" />
							</div>
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4">
							<Skeleton className="size-16 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-4 w-56" />
								<Skeleton className="h-3 w-20" />
							</div>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<div className="flex items-center gap-3">
							<Skeleton className="size-5 rounded" />
							<div className="space-y-2">
								<Skeleton className="h-5 w-36" />
								<Skeleton className="h-4 w-72 max-w-full" />
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{passwordFieldSlots.map((slot) => (
							<div key={slot} className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-10 w-full" />
							</div>
						))}
						<Skeleton className="h-10 w-full" />
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
