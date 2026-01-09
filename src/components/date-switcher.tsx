"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateSwitcherProps {
	selectedDate: Date;
	onDateChange: (date: Date) => void;
	minDate?: Date;
	maxDate?: Date;
	className?: string;
}

function formatDateForInput(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function formatDateDisplay(date: Date): string {
	return date.toLocaleDateString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short",
		timeZone: "Asia/Kolkata",
	});
}

function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

export function DateSwitcher({
	selectedDate,
	onDateChange,
	minDate,
	maxDate,
	className,
}: DateSwitcherProps) {
	const today = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);

	const isToday = isSameDay(selectedDate, today);

	const canGoNext = useMemo(() => {
		if (!maxDate) return !isToday;
		return selectedDate < maxDate && !isSameDay(selectedDate, maxDate);
	}, [selectedDate, maxDate, isToday]);

	const canGoPrev = useMemo(() => {
		if (!minDate) return true;
		return selectedDate > minDate && !isSameDay(selectedDate, minDate);
	}, [selectedDate, minDate]);

	const goToPreviousDay = useCallback(() => {
		const newDate = new Date(selectedDate);
		newDate.setDate(newDate.getDate() - 1);
		onDateChange(newDate);
	}, [selectedDate, onDateChange]);

	const goToNextDay = useCallback(() => {
		const newDate = new Date(selectedDate);
		newDate.setDate(newDate.getDate() + 1);
		onDateChange(newDate);
	}, [selectedDate, onDateChange]);

	const goToToday = useCallback(() => {
		onDateChange(today);
	}, [today, onDateChange]);

	const handleDateInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			if (value) {
				const [year, month, day] = value.split("-").map(Number);
				const newDate = new Date(year, month - 1, day);
				newDate.setHours(0, 0, 0, 0);
				onDateChange(newDate);
			}
		},
		[onDateChange],
	);

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				variant="outline"
				size="icon"
				className="size-8"
				onClick={goToPreviousDay}
				disabled={!canGoPrev}
				aria-label="Previous day"
			>
				<ChevronLeft className="size-4" />
			</Button>

			<div className="relative">
				<Button
					variant="outline"
					className="min-w-36 justify-start gap-2 font-medium"
					asChild
				>
					<label>
						<CalendarDays className="size-4 text-muted-foreground" />
						<span>{isToday ? "Today" : formatDateDisplay(selectedDate)}</span>
						<input
							type="date"
							value={formatDateForInput(selectedDate)}
							onChange={handleDateInputChange}
							max={
								maxDate
									? formatDateForInput(maxDate)
									: formatDateForInput(today)
							}
							min={minDate ? formatDateForInput(minDate) : undefined}
							className="absolute inset-0 opacity-0 cursor-pointer"
						/>
					</label>
				</Button>
			</div>

			<Button
				variant="outline"
				size="icon"
				className="size-8"
				onClick={goToNextDay}
				disabled={!canGoNext}
				aria-label="Next day"
			>
				<ChevronRight className="size-4" />
			</Button>

			{!isToday && (
				<Button
					variant="ghost"
					size="sm"
					onClick={goToToday}
					className="text-xs text-muted-foreground"
				>
					Today
				</Button>
			)}
		</div>
	);
}
