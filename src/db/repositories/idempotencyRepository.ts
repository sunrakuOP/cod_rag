import { pool } from "../pool";

/**
 * Tries to claim `key` for (orderId, eventType). Returns true the first time
 * (the send should happen) and false on every subsequent attempt (already
 * processed — skip). The UNIQUE constraint on idempotency_keys.key is the
 * actual lock; there's no separate "check if exists" query, which would
 * race under concurrent workers. This is the DB-backed idempotency CLAUDE.md
 * §4.2 requires instead of an in-memory Set.
 */
export async function tryClaimIdempotencyKey(
  key: string,
  orderId: number,
  eventType: string,
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO idempotency_keys (key, order_id, event_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (key) DO NOTHING
     RETURNING id`,
    [key, orderId, eventType],
  );

  return (result.rowCount ?? 0) > 0;
}
