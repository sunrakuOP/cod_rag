/**
 * orders: one row per COD order we track for confirmation.
 * (client_id, external_order_id) is unique so the same Shopify/Dropi order
 * can never be inserted twice for a client, regardless of how many times the
 * webhook that creates it fires.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      external_order_id TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_name TEXT,
      total NUMERIC(12, 2),
      status TEXT NOT NULL DEFAULT 'pending_confirmation'
        CHECK (status IN ('pending_confirmation', 'confirmed', 'no_show', 'dispatched')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (client_id, external_order_id)
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`DROP TABLE orders;`);
};

module.exports = {
  up,
  down,
};
