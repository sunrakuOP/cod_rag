/**
 * The Shopify webhook HMAC secret is tied to the app installation, not the
 * store, so it can't tell us which client a webhook belongs to. Shopify
 * sends the store's *.myshopify.com domain in the X-Shopify-Shop-Domain
 * header on every webhook call — this column is what we look up to resolve
 * that domain back to a client row.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const up = (pgm) => {
  pgm.sql(`ALTER TABLE clients ADD COLUMN shopify_shop_domain TEXT UNIQUE;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
const down = (pgm) => {
  pgm.sql(`ALTER TABLE clients DROP COLUMN shopify_shop_domain;`);
};

module.exports = {
  up,
  down,
};
