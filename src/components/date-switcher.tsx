"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

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

function formatMonthDisplay(date: Date): string {
	return date.toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
		timeZone: "Asia/Kolkata",
	});
}

function startOfDay(date: Date): Date {
	const nextDate = new Date(date);
	nextDate.setHours(0, 0, 0, 0);
	return nextDate;
}

function isSameDay(date1: Date, date2: Date): boolean {
	return (
		date1.getFullYear() === date2.getFullYear() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getDate() === date2.getDate()
	);
}

function isBeforeDay(date: Date, compareDate: Date): boolean {
	return startOfDay(date).getTime() < startOfDay(compareDate).getTime();
}

function isAfterDay(date: Date, compareDate: Date): boolean {
	return startOfDay(date).getTime() > startOfDay(compareDate).getTime();
}

function getCalendarDays(monthDate: Date): Date[] {
	const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const gridStart = new Date(firstDay);
	gridStart.setDate(firstDay.getDate() - firstDay.getDay());

	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(gridStart);
		date.setDate(gridStart.getDate() + index);
		return date;
	});
}

export function DateSwitcher({ selectedDate, onDateChange, minDate, maxDate, className }: DateSwitcherProps) {
	const today = useMemo(() => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	}, []);
	const effectiveMaxDate = maxDate ?? today;
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);
	const [visibleMonth, setVisibleMonth] = useState(
		() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
	);

	useEffect(() => {
		if (!isCalendarOpen) {
			setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
		}
	}, [selectedDate, isCalendarOpen]);

	const isToday = isSameDay(selectedDate, today);

	const canGoNext = useMemo(() => {
		return isBeforeDay(selectedDate, effectiveMaxDate);
	}, [selectedDate, effectiveMaxDate]);

	const canGoPrev = useMemo(() => {
		if (!minDate) return true;
		return isAfterDay(selectedDate, minDate);
	}, [selectedDate, minDate]);

	const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

	const canGoPrevMonth = useMemo(() => {
		if (!minDate) return true;
		const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
		const lastDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
		return !isBeforeDay(lastDayOfPreviousMonth, minDate);
	}, [visibleMonth, minDate]);

	const canGoNextMonth = useMemo(() => {
		const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
		return !isAfterDay(nextMonth, effectiveMaxDate);
	}, [visibleMonth, effectiveMaxDate]);

	const isDateDisabled = useCallback(
		(date: Date) => {
			if (minDate && isBeforeDay(date, minDate)) return true;
			return isAfterDay(date, effectiveMaxDate);
		},
		[minDate, effectiveMaxDate],
	);

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
		setIsCalendarOpen(false);
	}, [today, onDateChange]);

	const handleDateInputChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			if (value) {
				const [year, month, day] = value.split("-").map(Number);
				const newDate = new Date(year, month - 1, day);
				newDate.setHours(0, 0, 0, 0);
				onDateChange(newDate);
				setIsCalendarOpen(false);
			}
		},
		[onDateChange],
	);

	const goToPreviousMonth = useCallback(() => {
		setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1));
	}, []);

	const goToNextMonth = useCallback(() => {
		setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1));
	}, []);

	const selectCalendarDate = useCallback(
		(date: Date) => {
			if (isDateDisabled(date)) return;
			const nextDate = startOfDay(date);
			onDateChange(nextDate);
			setIsCalendarOpen(false);
		},
		[isDateDisabled, onDateChange],
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
					aria-expanded={isCalendarOpen}
					aria-haspopup="dialog"
					onClick={() => setIsCalendarOpen((open) => !open)}
				>
					<CalendarDays className="size-4 text-muted-foreground" />
					<span>{isToday ? "Today" : formatDateDisplay(selectedDate)}</span>
				</Button>

				{isCalendarOpen ? (
					<div
						className="absolute top-10 right-0 z-50 w-76 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
						role="dialog"
						aria-label="Choose date"
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								setIsCalendarOpen(false);
							}
						}}
					>
						<div className="mb-3 flex items-center justify-between gap-2">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={goToPreviousMonth}
								disabled={!canGoPrevMonth}
								aria-label="Previous month"
							>
								<ChevronLeft className="size-4" />
							</Button>
							<p className="text-sm font-semibold">{formatMonthDisplay(visibleMonth)}</p>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={goToNextMonth}
								disabled={!canGoNextMonth}
								aria-label="Next month"
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>

						<div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
							{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
								<div key={day} className="py-1">
									{day}
								</div>
							))}
						</div>
						<div className="mt-1 grid grid-cols-7 gap-1">
							{calendarDays.map((date) => {
								const isSelected = isSameDay(date, selectedDate);
								const isOutsideMonth = date.getMonth() !== visibleMonth.getMonth();
								const disabled = isDateDisabled(date);

								return (
									<button
										key={formatDateForInput(date)}
										type="button"
										className={cn(
											"flex h-8 items-center justify-center rounded-md text-sm transition-colors",
											isOutsideMonth && "text-muted-foreground/45",
											disabled && "cursor-not-allowed text-muted-foreground/30",
											!disabled && "hover:bg-muted",
											isSelected && "bg-primary text-primary-foreground hover:bg-primary",
										)}
										disabled={disabled}
										onClick={() => selectCalendarDate(date)}
										aria-current={isSelected ? "date" : undefined}
									>
										{date.getDate()}
									</button>
								);
							})}
						</div>

						<div className="mt-3 flex items-center justify-between border-t border-border pt-3">
							<input
								type="date"
								value={formatDateForInput(selectedDate)}
								onChange={handleDateInputChange}
								max={formatDateForInput(effectiveMaxDate)}
								min={minDate ? formatDateForInput(minDate) : undefined}
								className="h-8 rounded-md border border-input bg-background px-2 text-xs"
							/>
							<Button variant="ghost" size="sm" onClick={goToToday} disabled={isToday}>
								Today
							</Button>
						</div>
					</div>
				) : null}
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
				<Button variant="ghost" size="sm" onClick={goToToday} className="text-xs text-muted-foreground">
					Today
				</Button>
			)}
		</div>
	);
}
