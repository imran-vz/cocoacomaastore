"use client";

import { type ReactNode, Suspense, useEffect, useState } from "react";

function useIsDesktop() {
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 768px)");
		const updateIsDesktop = () => setIsDesktop(mediaQuery.matches);

		updateIsDesktop();
		mediaQuery.addEventListener("change", updateIsDesktop);

		return () => mediaQuery.removeEventListener("change", updateIsDesktop);
	}, []);

	return isDesktop;
}

export function DesktopChartSlot({ children, fallbackClassName }: { children: ReactNode; fallbackClassName: string }) {
	const isDesktop = useIsDesktop();

	if (!isDesktop) return null;

	return <Suspense fallback={<div className={fallbackClassName} aria-hidden="true" />}>{children}</Suspense>;
}
