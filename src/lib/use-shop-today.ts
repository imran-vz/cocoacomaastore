import { useEffect, useState } from "react";
import { type DayKey, dayEnd, dayKeyOf } from "@/lib/shop-calendar";

/** The shop's today, starting from the server's and moving on at midnight while the page stays open. */
export function useShopToday(serverToday: DayKey): DayKey {
	const [today, setToday] = useState(serverToday);
	useEffect(() => {
		const untilMidnight = Math.max(dayEnd(today).getTime() - Date.now(), 0);
		const timer = setTimeout(() => setToday(dayKeyOf()), untilMidnight + 1_000);
		return () => clearTimeout(timer);
	}, [today]);
	return today;
}
