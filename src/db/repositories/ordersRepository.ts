import { pool } from "../pool";
import type { OrderStatus } from "../../domain/confirmation";

export interface Order {
  id: number;
  clientId: number;
  externalOrderId: string;
  customerPhone: string;
  customerName: string | null;
  total: string | null;
  status: OrderStatus;
}

export interface UpsertOrderParams {
  clientId: number;
  externalOrderId: string;
  customerPhone: string;
  customerName?: string;
  total?: number;
}

/**
 * Order intake is itself idempotent: the same (client, external_order_id)
 * pair always resolves to the same row instead of erroring on a duplicate
 * webhook delivery. The confirm/retry idempotency (idempotency_keys) is a
 * separate concern layered on top of this.
 */
export async function upsertOrder(params: UpsertOrderParams): Promise<Order> {
  const result = await pool.query(
    `INSERT INTO orders (client_id, external_order_id, customer_phone, customer_name, total)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, external_order_id)
     DO UPDATE SET customer_phone = EXCLUDED.customer_phone
     RETURNING id, client_id, external_order_id, customer_phone, customer_name, total, status`,
    [
      params.clientId,
      params.externalOrderId,
      params.customerPhone,
      params.customerName ?? null,
      params.total ?? null,
    ],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    clientId: row.client_id,
    externalOrderId: row.external_order_id,
    customerPhone: row.customer_phone,
    customerName: row.customer_name,
    total: row.total,
    status: row.status,
  };
}
