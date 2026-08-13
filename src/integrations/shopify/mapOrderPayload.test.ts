import { describe, expect, it } from "vitest";
import { mapShopifyOrder } from "./mapOrderPayload";

describe("mapShopifyOrder", () => {
  it("prefers the top-level phone field when present", () => {
    const mapped = mapShopifyOrder({
      id: 1,
      phone: "+573001111111",
      shipping_address: { phone: "+573002222222" },
    });
    expect(mapped.customerPhone).toBe("+573001111111");
  });

  it("falls back to shipping_address.phone, then customer.phone, then billing_address.phone", () => {
    expect(
      mapShopifyOrder({ id: 1, shipping_address: { phone: "+573002222222" } }).customerPhone,
    ).toBe("+573002222222");

    expect(
      mapShopifyOrder({ id: 1, customer: { phone: "+573003333333" } }).customerPhone,
    ).toBe("+573003333333");

    expect(
      mapShopifyOrder({ id: 1, billing_address: { phone: "+573004444444" } }).customerPhone,
    ).toBe("+573004444444");
  });

  it("returns null when no field has a phone", () => {
    expect(mapShopifyOrder({ id: 1 }).customerPhone).toBeNull();
  });

  it("builds the customer name from first_name + last_name, preferring shipping_address", () => {
    const mapped = mapShopifyOrder({
      id: 1,
      shipping_address: { first_name: "Juan", last_name: "Pérez" },
      customer: { first_name: "Otro", last_name: "Nombre" },
    });
    expect(mapped.customerName).toBe("Juan Pérez");
  });

  it("parses total_price into a number", () => {
    expect(mapShopifyOrder({ id: 1, total_price: "89900.00" }).total).toBe(89900);
  });

  it("leaves total undefined when total_price is missing or invalid", () => {
    expect(mapShopifyOrder({ id: 1 }).total).toBeUndefined();
  });

  it("always stringifies the Shopify order id", () => {
    expect(mapShopifyOrder({ id: 5000000000123 }).externalOrderId).toBe("5000000000123");
  });
});
