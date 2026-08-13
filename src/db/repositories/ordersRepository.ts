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

const SELECT_ORDER_COLUMNS = `id, client_id, external_order_id, customer_phone, customer_name, total, status`;

function mapOrderRow(row: any): Order {
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
     RETURNING ${SELECT_ORDER_COLUMNS}`,
    [
      params.clientId,
      params.externalOrderId,
      params.customerPhone,
      params.customerName ?? null,
      params.total ?? null,
    ],
  );

  return mapOrderRow(result.rows[0]);
}

export async function findOrderById(id: number): Promise<Order | null> {
  const result = await pool.query(`SELECT ${SELECT_ORDER_COLUMNS} FROM orders WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapOrderRow(row) : null;
}

/**
 * Guarded by `AND status = 'pending_confirmation'` so a retry-cadence job
 * that fires after the order already moved on (confirmed, or marked
 * no_show/dispatched some other way) can't clobber that outcome.
 */
export async function markOrderNoShow(id: number): Promise<void> {
  await pool.query(
    `UPDATE orders SET status = 'no_show' WHERE id = $1 AND status = 'pending_confirmation'`,
    [id],
  );
}

/**
 * Same guard, for the inbound-reply path: only ever moves a still-pending
 * order to confirmed, never overwrites no_show/dispatched. Returns whether
 * this call was the one that made the transition — callers that need to
 * trigger a next step (e.g. dispatch) on the confirm should check this
 * instead of assuming their in-memory `order.status` is still fresh.
 */
export async function markOrderConfirmed(id: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE orders SET status = 'confirmed' WHERE id = $1 AND status = 'pending_confirmation'`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Same guard, one step further: only a still-confirmed order can move to
 * dispatched. Prevents a duplicate dispatch trigger (e.g. a second inbound
 * webhook hit for the same phone) from re-running the Dropi call once this
 * has already happened once.
 */
export async function markOrderDispatched(id: number): Promise<void> {
  await pool.query(
    `UPDATE orders SET status = 'dispatched' WHERE id = $1 AND status = 'confirmed'`,
    [id],
  );
}

/**
 * Our template has no reply buttons yet, so an inbound message can't be
 * matched to a specific order by button payload — this matches by phone
 * instead, picking the customer's most recently created pending order.
 * Simplification, documented in src/README.md: two pending orders for the
 * same phone at once would attribute the reply to the newer one.
 */
export async function findMostRecentPendingOrderByPhone(
  clientId: number,
  customerPhone: string,
): Promise<Order | null> {
  const result = await pool.query(
    `SELECT ${SELECT_ORDER_COLUMNS} FROM orders
     WHERE client_id = $1 AND customer_phone = $2 AND status = 'pending_confirmation'
     ORDER BY created_at DESC
     LIMIT 1`,
    [clientId, customerPhone],
  );

  const row = result.rows[0];
  return row ? mapOrderRow(row) : null;
}
