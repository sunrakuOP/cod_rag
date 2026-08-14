/**
 * telegram_chat_id identifies which Telegram chat gets operator notifications
 * for a client. Nullable, no backfill for any client — unlike
 * whatsapp_phone_number_id (needed immediately for inbound webhook routing),
 * there's no functional need for a real chat id yet, and Dovi's real one
 * shouldn't be wired up from cod_rag before the client is actually promoted
 * (see CLAUDE.md guardrail).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`ALTER TABLE clients ADD COLUMN telegram_chat_id TEXT;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`ALTER TABLE clients DROP COLUMN telegram_chat_id;`);
};

module.exports = {
  up,
  down,
};
