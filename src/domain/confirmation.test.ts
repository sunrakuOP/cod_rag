import { describe, expect, it } from "vitest";
import { shouldConfirm } from "./confirmation";

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
