/** An account the cart can take payment to. */
export type CheckoutUpiAccount = { id: string; label: string; upiId: string };

export type AdminUpiAccount = CheckoutUpiAccount & { enabled: boolean; createdAt: string };
