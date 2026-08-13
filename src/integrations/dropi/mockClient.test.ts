import { describe, expect, it } from "vitest";
import { markOrderReadyForDispatch } from "./mockClient";

describe("markOrderReadyForDispatch", () => {
  it("resolves with a dropiOrderId derived from the order id", async () => {
    const result = await markOrderReadyForDispatch(42);
    expect(result.dropiOrderId).toContain("42");
  });

  it("never rejects (mock always succeeds)", async () => {
    await expect(markOrderReadyForDispatch(1)).resolves.toBeDefined();
  });
});
