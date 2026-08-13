/**
 * Removes the order created by Shopify's "Send test notification" — its
 * placeholder data (phone "555-555-SHIP", Shopify's canned sample order id)
 * would otherwise pollute the confirmation-rate metrics. One-off cleanup,
 * safe to run in any environment: no-ops if the row is already gone.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    DELETE FROM idempotency_keys WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = '820982911946154500');
    DELETE FROM messages WHERE order_id IN (SELECT id FROM orders WHERE external_order_id = '820982911946154500');
    DELETE FROM orders WHERE external_order_id = '820982911946154500';
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
