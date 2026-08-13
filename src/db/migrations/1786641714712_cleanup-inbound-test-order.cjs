/**
 * Removes the order used to test the inbound WhatsApp webhook end to end.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    DELETE FROM idempotency_keys WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = 'INBOUND-TEST-001');
    DELETE FROM messages WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = 'INBOUND-TEST-001');
    DELETE FROM orders WHERE external_order_id = 'INBOUND-TEST-001';
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
