/**
 * clients: multi-tenant config. One row per store we sell the COD confirmation
 * system to. retry_cadence_minutes drives how the queue schedules retries per
 * client — this is what "multi-tenant from day 1" means in practice: no
 * client-specific values live in application code.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      retry_cadence_minutes INTEGER[] NOT NULL DEFAULT '{15,60,180}',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`DROP TABLE clients;`);
};

module.exports = {
  up,
  down,
};
