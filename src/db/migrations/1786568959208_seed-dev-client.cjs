/**
 * Seeds one client for local testing: "dovi" (the owner's own COD store,
 * case study #0 per CLAUDE.md §1). Client config is provisioned here, not
 * created implicitly by the API on first order — that's the multi-tenant
 * boundary: a new client is a row, never a code change.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    INSERT INTO clients (name, slug, retry_cadence_minutes)
    VALUES ('Dovi (dev/test)', 'dovi', '{15,60,180}');
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`DELETE FROM clients WHERE slug = 'dovi';`);
};

module.exports = {
  up,
  down,
};
