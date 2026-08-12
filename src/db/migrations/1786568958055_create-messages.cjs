/**
 * messages: log of every WhatsApp/Telegram message attempt, real or mock.
 * This table is the raw material for the confirmation-rate and cost metrics
 * the case study needs — nothing here is derived after the fact.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE messages (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      client_id INTEGER NOT NULL REFERENCES clients(id),
      direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
      channel TEXT NOT NULL,
      template_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'mocked_sent')),
      provider_message_id TEXT,
      cost_estimate NUMERIC(10, 4) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`DROP TABLE messages;`);
};

module.exports = {
  up,
  down,
};
