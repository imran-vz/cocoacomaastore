"use client";

import { useEffect } from "react";
import type { UpiAccount } from "@/db/schema";
import { useUpiStore } from "@/store/upi-store";

/**
 * Keeps the globally selected UPI id valid for the given accounts and
 * resolves it to an account, falling back to the first one.
 */
export function useSelectedUpiAccount(upiAccounts: UpiAccount[]) {
	const { selectedUpiId, setSelectedUpiId } = useUpiStore();

	useEffect(() => {
		const isValid = upiAccounts.some((account) => account.id.toString() === selectedUpiId);
		if (!isValid && upiAccounts.length > 0) setSelectedUpiId(upiAccounts[0].id.toString());
	}, [selectedUpiId, setSelectedUpiId, upiAccounts]);

	const selectedAccount: UpiAccount | undefined =
		upiAccounts.find((account) => account.id.toString() === selectedUpiId) ?? upiAccounts[0];

	return { selectedAccount, selectedUpiId, setSelectedUpiId };
}
