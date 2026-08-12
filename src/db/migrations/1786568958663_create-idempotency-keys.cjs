/**
 * idempotency_keys: the real deduplication mechanism (per CLAUDE.md §4 —
 * never an in-memory Set, it doesn't survive a restart). Before enqueueing a
 * send, the API tries to INSERT the key "order:{id}:{event_type}". If that
 * insert violates the UNIQUE constraint, the event was already processed and
 * we skip it — the constraint itself is the lock, no separate check-then-act
 * race condition.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE idempotency_keys (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`DROP TABLE idempotency_keys;`);
};

module.exports = {
  up,
  down,
};
