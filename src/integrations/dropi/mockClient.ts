export interface DropiDispatchResult {
  dropiOrderId: string;
}

/**
 * Stands in for the real Dropi API (no client token yet). Always succeeds —
 * once a real token exists this becomes a fallible network call and needs
 * the same queue+retry+idempotency treatment the WhatsApp send got when it
 * moved from mock to real (see src/README.md trade-offs).
 */
export async function markOrderReadyForDispatch(orderId: number): Promise<DropiDispatchResult> {
  return { dropiOrderId: `MOCK-DROPI-${orderId}-${Date.now()}` };
}
