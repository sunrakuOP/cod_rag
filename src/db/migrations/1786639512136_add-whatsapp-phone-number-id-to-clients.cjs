/**
 * Inbound WhatsApp webhooks carry the receiving phone_number_id in
 * value.metadata, not a client slug or any other identifier — this column
 * is what resolves that back to a tenant, the same role
 * shopify_shop_domain plays for Shopify webhooks. Also backfills Dovi's
 * real number so the inbound webhook can resolve to a client immediately.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`ALTER TABLE clients ADD COLUMN whatsapp_phone_number_id TEXT UNIQUE;`);
  pgm.sql(`UPDATE clients SET whatsapp_phone_number_id = '1254313717770824' WHERE slug = 'dovi';`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`ALTER TABLE clients DROP COLUMN whatsapp_phone_number_id;`);
};

module.exports = {
  up,
  down,
};
