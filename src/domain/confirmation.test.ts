import { describe, expect, it } from "vitest";
import { nextRetryDelayMinutes, shouldConfirm } from "./confirmation";

describe("shouldConfirm", () => {
  it("returns true for an order still pending confirmation", () => {
    expect(shouldConfirm({ status: "pending_confirmation" })).toBe(true);
  });

  it("returns false for an order already confirmed", () => {
    expect(shouldConfirm({ status: "confirmed" })).toBe(false);
  });

  it("returns false for an order marked no_show", () => {
    expect(shouldConfirm({ status: "no_show" })).toBe(false);
  });

  it("returns false for an order already dispatched", () => {
    expect(shouldConfirm({ status: "dispatched" })).toBe(false);
  });
});

describe("nextRetryDelayMinutes", () => {
  const cadence = [15, 60, 180];

  it("returns the first cadence step for retry attempt 1", () => {
    expect(nextRetryDelayMinutes(cadence, 1)).toBe(15);
  });

  it("returns the second cadence step for retry attempt 2", () => {
    expect(nextRetryDelayMinutes(cadence, 2)).toBe(60);
  });

  it("returns the last cadence step for retry attempt 3", () => {
    expect(nextRetryDelayMinutes(cadence, 3)).toBe(180);
  });

  it("returns null once the cadence is exhausted", () => {
    expect(nextRetryDelayMinutes(cadence, 4)).toBeNull();
  });

  it("returns null for an empty cadence (client configured no retries)", () => {
    expect(nextRetryDelayMinutes([], 1)).toBeNull();
  });
});
