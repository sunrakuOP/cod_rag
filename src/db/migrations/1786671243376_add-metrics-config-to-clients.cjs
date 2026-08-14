/**
 * Two nullable per-client fields the metrics report needs and can't derive
 * on its own — both are numbers only the operator has, not something the
 * system measured:
 *
 * - baseline_no_show_rate: the client's own estimate of their no-show rate
 *   before cod_rag (e.g. from manual/Excel tracking). No system default —
 *   nothing in this codebase ever measured a "before" state.
 * - whatsapp_utility_cost_estimate: cost per utility-template message, in
 *   the client's currency. Not hardcoded from a looked-up Meta price: rates
 *   vary by country/category and change over time, so a baked-in guess would
 *   go stale silently. Read from WhatsApp Manager > Billing for the real
 *   number.
 *
 * Both NULL until the operator sets them; reportMetrics.ts must treat NULL
 * as "sin datos", never coerce to 0.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE clients
      ADD COLUMN baseline_no_show_rate NUMERIC(5, 2),
      ADD COLUMN whatsapp_utility_cost_estimate NUMERIC(10, 4);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE clients
      DROP COLUMN baseline_no_show_rate,
      DROP COLUMN whatsapp_utility_cost_estimate;
  `);
};

module.exports = {
  up,
  down,
};
