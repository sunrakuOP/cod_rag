/**
 * Removes the manual test order used to verify the retry-cadence wiring
 * didn't crash on a failed send. Safe even with a pending delayed
 * retry-check job for this order still in Redis — that job's first step is
 * `findOrderById`, which handles a missing order by just stopping.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    DELETE FROM idempotency_keys WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = 'RETRY-TEST-001');
    DELETE FROM messages WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = 'RETRY-TEST-001');
    DELETE FROM orders WHERE external_order_id = 'RETRY-TEST-001';
  `);
};

/**
 * Irreversible cleanup — nothing to undo.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {};

module.exports = {
  up,
  down,
};
