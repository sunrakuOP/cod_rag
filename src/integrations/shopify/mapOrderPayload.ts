export interface ShopifyOrderPayload {
  id: number | string;
  phone?: string | null;
  total_price?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  billing_address?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
}

export interface MappedShopifyOrder {
  externalOrderId: string;
  customerPhone: string | null;
  customerName?: string;
  total?: number;
}

interface NamedPart {
  first_name?: string | null;
  last_name?: string | null;
}

function fullName(part: NamedPart | null | undefined): string | undefined {
  if (!part) return undefined;
  const name = [part.first_name, part.last_name].filter(Boolean).join(" ").trim();
  return name || undefined;
}

/**
 * Where the phone actually lives varies by store setup (COD form apps like
 * Releasit often put it in shipping_address rather than customer). Order
 * intake tries every field Shopify's REST order resource can populate, in
 * order of reliability, instead of assuming one.
 */
export function mapShopifyOrder(payload: ShopifyOrderPayload): MappedShopifyOrder {
  const customerPhone =
    payload.phone ||
    payload.shipping_address?.phone ||
    payload.customer?.phone ||
    payload.billing_address?.phone ||
    null;

  const customerName =
    fullName(payload.shipping_address) ?? fullName(payload.customer) ?? fullName(payload.billing_address);

  const total = payload.total_price ? Number.parseFloat(payload.total_price) : undefined;

  return {
    externalOrderId: String(payload.id),
    customerPhone,
    customerName,
    total: total !== undefined && Number.isFinite(total) ? total : undefined,
  };
}
